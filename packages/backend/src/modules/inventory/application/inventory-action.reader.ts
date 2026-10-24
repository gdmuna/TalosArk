import { Injectable } from '@nestjs/common';
import type { InventoryScope } from '@talos-ark/contracts/inventory';
import type { PermissionSubject } from '@/core/permission/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import {
    FacilityPositionReader,
    type FacilitySourcePosition,
} from '@/modules/facility/public/index.js';
import { expiryValue } from '@/modules/material/public/index.js';
import { InventoryCalendar } from '../domain/inventory-calendar.js';
import { InventoryAccessService } from './inventory-access.service.js';
import { InventoryError } from './inventory.error.js';
import { planInventoryAction } from '../domain/inventory-action.js';
import {
    parseInventoryQuantity,
    formatInventoryQuantity,
} from '../domain/value-objects/inventory-quantity.js';

export interface InventoryActionFact {
    stock: {
        id: string;
        instanceId: string;
        version: number;
        status: string;
        quantity: string;
        code: string | null;
        materialName: string;
        quantityUnit: string;
        quantityScale: number;
    };
    source: FacilitySourcePosition | null;
    expired: boolean;
}

/** Transaction-local stock facts for trusted use cases; never return this shape over HTTP. */
@Injectable()
export class InventoryActionReader {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly access: InventoryAccessService,
        private readonly positions: FacilityPositionReader,
        private readonly calendar: InventoryCalendar
    ) {}
    blocked(
        fact: InventoryActionFact,
        intent: { kind: 'consume'; quantity: string } | { kind: 'transfer' }
    ) {
        const plan = planInventoryAction(
            {
                quantity: parseInventoryQuantity(fact.stock.quantity),
                status: fact.stock.status,
                quantityScale: fact.stock.quantityScale,
                expired: fact.expired,
            },
            intent.kind === 'consume'
                ? { kind: 'consume', quantity: parseInventoryQuantity(intent.quantity) }
                : intent
        );
        if (!plan.ok) return plan.reason;
        return fact.source?.writable ? null : 'state';
    }
    validate(
        fact: InventoryActionFact,
        intent: { kind: 'consume'; quantity: string } | { kind: 'transfer' }
    ) {
        const reason = this.blocked(fact, intent);
        if (reason || !fact.source) throw new InventoryError({ reason: reason ?? 'state' });
        return fact.source;
    }
    async read(
        subject: PermissionSubject,
        scope: InventoryScope,
        ids: readonly string[]
    ): Promise<Map<string, InventoryActionFact>> {
        await this.access.require(subject, scope);
        const rows = await this.database.queryClient.stockItem.findMany({
            where: { ...scope, id: { in: [...new Set(ids)] } },
            select: {
                id: true,
                instanceId: true,
                version: true,
                status: true,
                quantity: true,
                placement: { select: { storageNodeId: true } },
                instance: {
                    select: {
                        code: true,
                        expiryKind: true,
                        expiresOn: true,
                        material: {
                            select: { name: true, quantityUnit: true, quantityScale: true },
                        },
                    },
                },
            },
        });
        if (rows.length !== new Set(ids).size) throw new InventoryError({ reason: 'forbidden' });
        const sources = await this.positions.inspectSources({
            organizationId: scope.organizationId,
            nodeIds: rows.flatMap((row) => (row.placement ? [row.placement.storageNodeId] : [])),
        });
        return new Map(
            rows.map((stock) => [
                stock.id,
                {
                    stock: {
                        id: stock.id,
                        instanceId: stock.instanceId,
                        version: stock.version,
                        status: stock.status,
                        quantity: formatInventoryQuantity(stock.quantity),
                        code: stock.instance.code,
                        materialName: stock.instance.material.name,
                        quantityUnit: stock.instance.material.quantityUnit,
                        quantityScale: stock.instance.material.quantityScale,
                    },
                    source: stock.placement
                        ? (sources.get(stock.placement.storageNodeId) ?? null)
                        : null,
                    expired:
                        this.calendar.risk(expiryValue(stock.instance), this.calendar.today()) ===
                        'EXPIRED',
                },
            ])
        );
    }
}
