import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma, MaterialInstance } from '@root/prisma/generated/client.js';
import {
    ReceiptSchema,
    InstanceCorrectionSchema,
    OperationReceiptSchema,
    type InventoryScope,
    type InventoryQuery,
    type Receipt,
    type InstanceCorrection,
    type OperationReceipt,
} from '@talos-ark/contracts/inventory';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { ResourceKernel } from '@/core/resource/index.js';
import { AuditKernel, type AuditValue } from '@/core/audit/index.js';
import { IdempotencyKernel, type IdempotencyResultCodec } from '@/core/idempotency/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import {
    MaterialReceiptSource,
    calendarDate,
    expiryValue,
    batchView,
} from '@/modules/material/public/index.js';
import { FacilityPositionReader } from '@/modules/facility/public/index.js';
import { InventoryAccessService, inventoryScope } from './inventory-access.service.js';
import { InventoryCalendar } from '../domain/inventory-calendar.js';
import {
    parseInventoryQuantity,
    formatInventoryQuantity,
} from '../domain/value-objects/inventory-quantity.js';
import { inventoryPermission as p } from '../contribution/inventory-authorization.contribution.js';
import { InventoryError } from './inventory.error.js';
import { inventoryErrors } from './inventory.error.mapper.js';
import { InventoryIdempotencyRepository } from '../infrastructure/persistence/inventory-idempotency.repository.js';

function operationReceipt(value: unknown): OperationReceipt {
    const result = OperationReceiptSchema.safeParse(value);
    if (!result.success) throw new InventoryError({ reason: 'result' }, { cause: result.error });
    return result.data;
}
export const operationCodec: IdempotencyResultCodec<OperationReceipt> = {
    encode: (value) => ({ ...value }),
    decode: operationReceipt,
};
const stockInclude = {
    instance: { include: { material: true, batch: true } },
    placement: true,
} as const;
type Stock = Prisma.StockItemGetPayload<{ include: typeof stockInclude }>;
@Injectable()
export class InventoryService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly writes: OrganizationWriteKernel,
        private readonly access: InventoryAccessService,
        private readonly calendar: InventoryCalendar,
        private readonly materials: MaterialReceiptSource,
        private readonly positions: FacilityPositionReader,
        private readonly resources: ResourceKernel,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter,
        private readonly idempotency: IdempotencyKernel,
        private readonly reservations: InventoryIdempotencyRepository
    ) {}
    subject() {
        return { kind: 'user' as const, userId: this.actor.requireActor().userId };
    }
    read<T>(work: () => Promise<T>) {
        return this.database.transaction.run(
            work,
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }
    context(input: InventoryScope) {
        const scope = inventoryScope(input);
        return this.read(async () => {
            await this.access.require(this.subject(), scope);
            return {
                capabilities: await this.access.capabilities(this.subject(), scope),
                timeZone: this.calendar.timeZone,
                businessDate: this.calendar.today(),
            };
        });
    }
    private async stock(scope: InventoryScope, id: string) {
        const row = await this.database.queryClient.stockItem.findFirst({
            where: { ...inventoryScope(scope), id },
            include: stockInclude,
        });
        if (!row) throw new InventoryError({ reason: 'forbidden' });
        return row;
    }
    private async project(scope: InventoryScope, rows: Stock[]) {
        const capabilities = await this.access.capabilities(this.subject(), scope);
        const locations = await this.positions.describeMany(this.subject(), {
            ...scope,
            nodeIds: rows.flatMap((row) => (row.placement ? [row.placement.storageNodeId] : [])),
        });
        const today = this.calendar.today();
        return rows.map((row) => {
            const { instance } = row;
            const material = instance.material;
            const expiry = expiryValue(instance);
            return {
                id: row.id,
                organizationId: row.organizationId,
                workspaceId: row.workspaceId,
                resourceId: row.resourceId,
                instanceId: instance.id,
                instanceResourceId: instance.resourceId,
                code: instance.code,
                label: instance.label ?? '',
                notes: instance.notes ?? '',
                manufacturedOn: calendarDate(instance.manufacturedOn),
                receivedOn: calendarDate(instance.receivedOn),
                openedAt: instance.openedAt?.toISOString() ?? null,
                expiry,
                expiryRisk: this.calendar.risk(expiry, today),
                initialQuantity: formatInventoryQuantity(instance.initialQuantity),
                quantity: formatInventoryQuantity(row.quantity),
                quantityUnit: material.quantityUnit,
                quantityScale: material.quantityScale,
                status: row.status,
                version: row.version,
                revision: instance.revision,
                createdAt: row.createdAt.toISOString(),
                material: {
                    id: material.id,
                    code: material.code,
                    name: material.name,
                    archivedAt: material.archivedAt?.toISOString() ?? null,
                },
                batch: instance.batch ? batchView(instance.batch) : null,
                location: row.placement
                    ? (locations.get(row.placement.storageNodeId) ?? null)
                    : null,
                locationRestricted: !!row.placement && !locations.has(row.placement.storageNodeId),
                capabilities,
            };
        });
    }
    list(input: InventoryScope, query: InventoryQuery) {
        const scope = inventoryScope(input);
        return this.read(async () => {
            await this.access.require(this.subject(), scope);
            const instance: Prisma.MaterialInstanceWhereInput = {
                ...(query.materialId ? { materialId: query.materialId } : {}),
                ...(query.batchId ? { batchId: query.batchId } : {}),
            };
            if (query.q)
                instance.OR = [
                    { code: { contains: query.q, mode: 'insensitive' } },
                    { label: { contains: query.q, mode: 'insensitive' } },
                    { material: { name: { contains: query.q, mode: 'insensitive' } } },
                ];
            if (query.expiryRisk) {
                if (query.expiryRisk === 'NONE' || query.expiryRisk === 'UNKNOWN')
                    instance.expiryKind = query.expiryRisk;
                else {
                    instance.expiryKind = 'DATED';
                    instance.expiresOn =
                        query.expiryRisk === 'EXPIRED'
                            ? { lt: new Date(`${this.calendar.today()}T00:00:00Z`) }
                            : { gte: new Date(`${this.calendar.today()}T00:00:00Z`) };
                }
            }
            const where: Prisma.StockItemWhereInput = {
                ...scope,
                instance,
                ...(query.status ? { status: query.status } : {}),
                ...(query.stockItemId ? { id: query.stockItemId } : {}),
                ...(query.nodeId ? { placement: { storageNodeId: query.nodeId } } : {}),
                ...(query.operationId
                    ? {
                          transactionLines: {
                              some: { transaction: { operationId: query.operationId } },
                          },
                      }
                    : {}),
            };
            const total = await this.database.queryClient.stockItem.count({ where });
            const rows = await this.database.queryClient.stockItem.findMany({
                where,
                include: stockInclude,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            });
            return {
                items: await this.project(scope, rows),
                total,
                page: query.page,
                pageSize: query.pageSize,
            };
        });
    }
    get(input: InventoryScope, id: string) {
        const scope = inventoryScope(input);
        return this.read(async () => {
            await this.access.require(this.subject(), scope);
            return (await this.project(scope, [await this.stock(scope, id)]))[0];
        });
    }
    async authorizeOperation(organizationId: string, operationId: string, permission: string) {
        const row = await this.database.queryClient.inventoryOperation.findFirst({
            where: { organizationId, id: operationId },
            include: { transactions: { select: { workspaceId: true } } },
        });
        if (!row || !row.completedAt || !row.transactions.length)
            throw new InventoryError({ reason: 'forbidden' });
        for (const workspaceId of [...new Set(row.transactions.map((t) => t.workspaceId))])
            await this.access.require(this.subject(), { organizationId, workspaceId }, permission);
        return row;
    }
    operation(organizationId: string, operationId: string) {
        return this.read(async () =>
            operationReceipt(
                (await this.authorizeOperation(organizationId, operationId, p.read)).result
            )
        );
    }
    receive(input: InventoryScope, request: Receipt) {
        const scope = inventoryScope(input);
        const body = ReceiptSchema.parse(request);
        const quantity = parseInventoryQuantity(body.quantity);
        const normalized = {
            ...body,
            quantity: formatInventoryQuantity(quantity),
            openedAt: body.openedAt ? new Date(body.openedAt).toISOString() : null,
        };
        const prepared = this.idempotency.prepare({
            scope: { kind: 'workspace', ...scope },
            operation: 'inventory.receive',
            key: body.idempotencyKey,
            payload: { actorUserId: this.subject().userId, ...normalized },
        });
        return inventoryErrors.run(() =>
            this.writes.run({
                organizationId: scope.organizationId,
                authorize: () => this.access.require(this.subject(), scope, p.receive),
                execute: async () => {
                    const execution = await this.idempotency.run(
                        prepared,
                        async () => {
                            const operation = await this.reservations.row(prepared);
                            const material = await this.materials.requireMaterial(
                                this.subject(),
                                scope,
                                body.materialId
                            );
                            if (
                                material.archivedAt ||
                                quantity.decimalPlaces() > material.quantityScale
                            )
                                throw new InventoryError({
                                    reason: material.archivedAt ? 'state' : 'invalid',
                                });
                            let batchId: string | null = null;
                            if (body.batch.kind === 'existing') {
                                const batch = await this.materials.requireBatch(
                                    scope,
                                    material.id,
                                    body.batch.id
                                );
                                if (batch.archivedAt) throw new InventoryError({ reason: 'state' });
                                if (batch.revision !== body.batch.expectedRevision)
                                    throw new InventoryError({ reason: 'conflict' });
                                batchId = batch.id;
                            } else if (body.batch.kind === 'create')
                                batchId = (
                                    await this.materials.createBatch(
                                        this.subject(),
                                        scope,
                                        material.id,
                                        body.batch.value
                                    )
                                ).id;
                            const fields = this.calendar.fields(body, body.confirmExpired);
                            const position = await this.positions.requireAvailable({
                                ...scope,
                                ...body.position,
                                subject: this.subject(),
                            });
                            let code = body.code;
                            for (let attempt = 0; !code && attempt < 5; attempt++) {
                                const candidate = `INS-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
                                if (
                                    !(await this.database.queryClient.materialInstance.findUnique({
                                        where: {
                                            workspaceId_code: {
                                                workspaceId: scope.workspaceId,
                                                code: candidate,
                                            },
                                        },
                                        select: { id: true },
                                    }))
                                )
                                    code = candidate;
                            }
                            if (!code) throw new InventoryError({ reason: 'conflict' });
                            const resource = await this.resources.create({
                                organizationId: scope.organizationId,
                                kind: 'MATERIAL_INSTANCE',
                            });
                            const instance =
                                await this.database.queryClient.materialInstance.create({
                                    data: {
                                        ...scope,
                                        materialId: material.id,
                                        batchId,
                                        code,
                                        initialQuantity: quantity,
                                        resourceId: resource.id,
                                        ...fields,
                                    },
                                });
                            const stockResource = await this.resources.create({
                                organizationId: scope.organizationId,
                                kind: 'STOCK_ITEM',
                            });
                            const stock = await this.database.queryClient.stockItem.create({
                                data: {
                                    ...scope,
                                    instanceId: instance.id,
                                    resourceId: stockResource.id,
                                    quantity,
                                    status: quantity.isZero() ? 'DEPLETED' : 'IN_STOCK',
                                },
                            });
                            await this.database.queryClient.placement.create({
                                data: {
                                    ...scope,
                                    stockItemId: stock.id,
                                    storageNodeId: position.id,
                                },
                            });
                            await this.database.queryClient.inventoryTransaction.create({
                                data: {
                                    ...scope,
                                    operationId: operation.id,
                                    actorUserId: this.subject().userId,
                                    type: 'RECEIPT',
                                    lines: {
                                        create: {
                                            stockItemId: stock.id,
                                            lineNumber: 1,
                                            unitSnapshot: material.quantityUnit,
                                            quantityBefore: '0',
                                            quantityAfter: quantity,
                                            statusBefore: null,
                                            statusAfter: stock.status,
                                            toNodeId: position.id,
                                            toNodePathSnapshot: position.location.path,
                                            toFacilityIdSnapshot: position.facilityId,
                                            toTopologyIdSnapshot: position.topologyId,
                                        },
                                    },
                                },
                            });
                            await this.record(scope, 'inventory.receive', stock.resourceId, code, {
                                operationId: operation.id,
                                quantity: formatInventoryQuantity(quantity),
                                unit: material.quantityUnit,
                                batchId,
                                instanceId: instance.id,
                                position: {
                                    facilityId: position.facilityId,
                                    topologyId: position.topologyId,
                                    nodeId: position.id,
                                },
                                facts: this.factSnapshot(instance),
                            });
                            return {
                                operationId: operation.id,
                                kind: 'inventory.receive' as const,
                                stockItemId: stock.id,
                                instanceId: instance.id,
                                nodeId: null,
                            };
                        },
                        operationCodec
                    );
                    if (execution.kind === 'replayed')
                        await this.authorizeOperation(
                            scope.organizationId,
                            execution.value.operationId,
                            p.receive
                        );
                    return execution.value;
                },
            })
        );
    }
    correct(input: InventoryScope, id: string, request: InstanceCorrection) {
        const scope = inventoryScope(input);
        const body = InstanceCorrectionSchema.parse(request);
        return inventoryErrors.run(() =>
            this.writes.run({
                organizationId: scope.organizationId,
                authorize: () => this.access.require(this.subject(), scope, p.updateFacts),
                execute: async () => {
                    const before = await this.stock(scope, id);
                    if (before.instance.revision !== body.expectedRevision)
                        throw new InventoryError({ reason: 'conflict' });
                    const after = await this.database.queryClient.materialInstance.update({
                        where: { id: before.instanceId },
                        data: {
                            ...this.calendar.fields(body, body.confirmExpired),
                            revision: { increment: 1 },
                        },
                    });
                    await this.record(
                        scope,
                        'inventory.facts.correct',
                        before.resourceId,
                        after.code,
                        {
                            reason: body.reason,
                            before: this.factSnapshot(before.instance),
                            after: this.factSnapshot(after),
                        }
                    );
                    return (await this.project(scope, [await this.stock(scope, id)]))[0];
                },
            })
        );
    }
    private factSnapshot(row: MaterialInstance) {
        return {
            label: row.label,
            notesHash: createHash('sha256')
                .update(row.notes ?? '')
                .digest('hex'),
            manufacturedOn: calendarDate(row.manufacturedOn),
            receivedOn: calendarDate(row.receivedOn),
            expiry: expiryValue(row),
            openedAt: row.openedAt?.toISOString() ?? null,
            revision: row.revision,
        };
    }
    record(
        scope: InventoryScope,
        action: string,
        resourceId: string,
        label: string,
        details: Record<string, AuditValue>
    ) {
        return this.audit.record({
            ...inventoryScope(scope),
            actorUserId: this.subject().userId,
            action,
            occurredAt: new Date(),
            requestId: this.actor.get()?.requestId,
            resources: [{ resourceId, labelSnapshot: label }],
            details,
        });
    }
    transactions(input: InventoryScope, query: InventoryQuery, id?: string) {
        const scope = inventoryScope(input);
        return this.read(async () => {
            await this.access.require(this.subject(), scope);
            const where: Prisma.InventoryTransactionWhereInput = {
                ...scope,
                ...(id ? { id } : {}),
                ...(query.operationId ? { operationId: query.operationId } : {}),
                ...(query.stockItemId ||
                query.materialId ||
                query.batchId ||
                query.nodeId ||
                query.q
                    ? {
                          lines: {
                              some: {
                                  ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}),
                                  ...(query.nodeId
                                      ? {
                                            OR: [
                                                { fromNodeId: query.nodeId },
                                                { toNodeId: query.nodeId },
                                            ],
                                        }
                                      : {}),
                                  stockItem: {
                                      instance: {
                                          ...(query.materialId
                                              ? { materialId: query.materialId }
                                              : {}),
                                          ...(query.batchId ? { batchId: query.batchId } : {}),
                                          ...(query.q
                                              ? { code: { contains: query.q, mode: 'insensitive' } }
                                              : {}),
                                      },
                                  },
                              },
                          },
                      }
                    : {}),
            };
            if (query.status || query.expiryRisk) throw new InventoryError({ reason: 'invalid' });
            const total = await this.database.queryClient.inventoryTransaction.count({ where });
            const rows = await this.database.queryClient.inventoryTransaction.findMany({
                where,
                include: { lines: { orderBy: { lineNumber: 'asc' } } },
                orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            });
            const items = rows.map((row) => ({
                id: row.id,
                operationId: row.operationId,
                workspaceId: row.workspaceId,
                type: row.type,
                actorUserId: row.actorUserId,
                reason: row.reason,
                occurredAt: row.occurredAt.toISOString(),
                lines: row.lines.map((line) => ({
                    stockItemId: line.stockItemId,
                    lineNumber: line.lineNumber,
                    unitSnapshot: line.unitSnapshot,
                    statusBefore: line.statusBefore,
                    statusAfter: line.statusAfter,
                    fromNodeId: line.fromNodeId,
                    toNodeId: line.toNodeId,
                    fromNodePathSnapshot: line.fromNodePathSnapshot,
                    toNodePathSnapshot: line.toNodePathSnapshot,
                    fromFacilityIdSnapshot: line.fromFacilityIdSnapshot,
                    toFacilityIdSnapshot: line.toFacilityIdSnapshot,
                    fromTopologyIdSnapshot: line.fromTopologyIdSnapshot,
                    toTopologyIdSnapshot: line.toTopologyIdSnapshot,
                    quantityBefore: formatInventoryQuantity(line.quantityBefore),
                    quantityAfter: formatInventoryQuantity(line.quantityAfter),
                })),
            }));
            if (id) {
                if (!items[0]) throw new InventoryError({ reason: 'forbidden' });
                return items[0];
            }
            return { items, total, page: query.page, pageSize: query.pageSize };
        });
    }
}
