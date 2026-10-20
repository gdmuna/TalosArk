import { Injectable } from '@nestjs/common';
import { OperationReceiptSchema, type OperationReceipt } from '@talos-ark/contracts/inventory';
import type { IdempotencyResultCodec } from '@/core/idempotency/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { inventoryPermission as p } from '../contribution/inventory-authorization.contribution.js';
import { InventoryError } from './inventory.error.js';
import { InventoryAccessService } from './inventory-access.service.js';
import { FacilityPositionReader } from '@/modules/facility/public/index.js';

function operationReceipt(value: unknown): OperationReceipt {
    const result = OperationReceiptSchema.safeParse(value);
    if (!result.success) throw new InventoryError({ reason: 'result' }, { cause: result.error });
    return result.data;
}

export const operationCodec: IdempotencyResultCodec<OperationReceipt> = {
    encode: (value) => ({ ...value }),
    decode: operationReceipt,
};

@Injectable()
export class InventoryOperationService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly access: InventoryAccessService,
        private readonly actor: AlsContextAdapter,
        private readonly positions: FacilityPositionReader
    ) {}

    private subject() {
        return { kind: 'user' as const, userId: this.actor.requireActor().userId };
    }

    async authorizeOperation(
        organizationId: string,
        operationId: string,
        permission: string = p.read
    ) {
        const row = await this.database.queryClient.inventoryOperation.findFirst({
            where: { organizationId, id: operationId },
            include: {
                transactions: {
                    include: {
                        lines: {
                            select: {
                                fromFacilityIdSnapshot: true,
                                toFacilityIdSnapshot: true,
                            },
                        },
                    },
                },
            },
        });
        if (!row || !row.completedAt || !row.transactions.length)
            throw new InventoryError({ reason: 'forbidden' });
        for (const workspaceId of [...new Set(row.transactions.map((item) => item.workspaceId))])
            await this.access.require(this.subject(), { organizationId, workspaceId }, permission);
        return row;
    }

    operation(organizationId: string, operationId: string) {
        return this.database.transaction.run(
            async () => {
                const operation = await this.authorizeOperation(organizationId, operationId);
                return this.project(operationReceipt(operation.result), operation);
            },
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }

    async project(
        receipt: OperationReceipt,
        operation: Awaited<ReturnType<InventoryOperationService['authorizeOperation']>>
    ) {
        if (!receipt.nodeId) return receipt;
        for (const transaction of operation.transactions) {
            const ids = transaction.lines.flatMap((line) => {
                const id =
                    receipt.kind === 'inventory.consume' || receipt.kind === 'inventory.adjust'
                        ? line.fromFacilityIdSnapshot
                        : line.toFacilityIdSnapshot;
                return id ? [id] : [];
            });
            const visible = await this.positions.visibleFacilities(
                this.subject(),
                {
                    organizationId: operation.organizationId,
                    workspaceId: transaction.workspaceId,
                },
                ids
            );
            if (!ids.length || ids.some((id) => !visible.has(id)))
                return { ...receipt, nodeId: null };
        }
        return receipt;
    }
}
