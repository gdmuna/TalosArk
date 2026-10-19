import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
    RelocationSchema,
    RelocationExecuteSchema,
    type Relocation,
    type RelocationExecute,
} from '@talos-ark/contracts/inventory';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { IdempotencyKernel } from '@/core/idempotency/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { FacilityRelocation } from '@/modules/facility/public/index.js';
import { InventoryAccessService } from './inventory-access.service.js';
import { InventoryService, operationCodec } from './inventory.service.js';
import { inventoryPermission as p } from '../contribution/inventory-authorization.contribution.js';
import { InventoryIdempotencyRepository } from '../infrastructure/persistence/inventory-idempotency.repository.js';
import { InventoryError } from './inventory.error.js';
import { inventoryErrors } from './inventory.error.mapper.js';
import { formatInventoryQuantity } from '../domain/value-objects/inventory-quantity.js';

@Injectable()
export class InventoryRelocationService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly writes: OrganizationWriteKernel,
        private readonly facilities: FacilityRelocation,
        private readonly access: InventoryAccessService,
        private readonly inventory: InventoryService,
        private readonly reservations: InventoryIdempotencyRepository,
        private readonly idempotency: IdempotencyKernel,
        private readonly actor: AlsContextAdapter,
        private readonly audit: AuditKernel
    ) {}
    private subject() {
        return { kind: 'user' as const, userId: this.actor.requireActor().userId };
    }
    private async inspect(organizationId: string, body: Relocation, lock: boolean) {
        const layout = await this.facilities.prepare(this.subject(), organizationId, body, lock);
        if (layout.nodes.length > 10000) throw new InventoryError({ reason: 'limit' });
        const items = await this.database.queryClient.placement.findMany({
            where: { organizationId, storageNodeId: { in: layout.nodes.map((n) => n.id) } },
            include: { stockItem: { include: { instance: { include: { material: true } } } } },
            orderBy: { stockItemId: 'asc' },
            take: 1001,
        });
        if (items.length > 1000) throw new InventoryError({ reason: 'limit' });
        if (!items.length) throw new InventoryError({ reason: 'state' });
        const workspaceIds = [...new Set(items.map((item) => item.workspaceId))].sort();
        for (const workspaceId of workspaceIds) {
            await this.access.require(this.subject(), { organizationId, workspaceId }, p.transfer);
            await this.facilities.requireWorkspaceAccess(
                organizationId,
                workspaceId,
                body.targetFacilityId
            );
        }
        const fingerprint = createHash('sha256')
            .update(
                JSON.stringify({
                    input: body,
                    source: layout.source,
                    target: layout.target,
                    sourceRevision: layout.sourceLayout.revision,
                    targetRevision: layout.targetLayout.revision,
                    root: layout.root.id,
                    grants: layout.grants,
                    items: items.map((item) => [
                        item.id,
                        item.storageNodeId,
                        item.stockItemId,
                        item.workspaceId,
                        item.stockItem.version,
                        item.stockItem.instance.revision,
                    ]),
                })
            )
            .digest('hex');
        return { layout, items, workspaceIds, fingerprint };
    }
    preview(organizationId: string, request: Relocation) {
        const body = RelocationSchema.parse(request);
        return this.database.transaction.run(
            async () => {
                const { layout, items, workspaceIds, fingerprint } = await this.inspect(
                    organizationId,
                    body,
                    false
                );
                return {
                    fingerprint,
                    nodeCount: layout.nodes.length,
                    itemCount: items.length,
                    workspaceIds,
                    sourcePath: layout.sourcePath,
                    targetPath: layout.targetPath,
                    sourceManagementWorkspaceId: layout.source.managementWorkspaceId,
                    targetManagementWorkspaceId: layout.target.managementWorkspaceId,
                    sourceAccessWorkspaceIds: [
                        ...new Set([
                            layout.source.managementWorkspaceId,
                            ...layout.grants
                                .filter((g) => g.facilityId === layout.source.id)
                                .map((g) => g.workspaceId),
                        ]),
                    ],
                    targetAccessWorkspaceIds: [
                        ...new Set([
                            layout.target.managementWorkspaceId,
                            ...layout.grants
                                .filter((g) => g.facilityId === layout.target.id)
                                .map((g) => g.workspaceId),
                        ]),
                    ],
                    items: items.map((item) => ({
                        stockItemId: item.stockItemId,
                        code: item.stockItem.instance.code,
                        workspaceId: item.workspaceId,
                        quantity: formatInventoryQuantity(item.stockItem.quantity),
                    })),
                };
            },
            { isolationLevel: 'RepeatableRead' }
        );
    }
    execute(organizationId: string, request: RelocationExecute) {
        const body = RelocationExecuteSchema.parse(request);
        const {
            expectedFingerprint: _fingerprint,
            idempotencyKey: _key,
            reason: _reason,
            confirmGovernanceChange: _confirm,
            ...input
        } = body;
        const prepared = this.idempotency.prepare({
            scope: { kind: 'organization-user', organizationId, userId: this.subject().userId },
            operation: 'inventory.relocate',
            key: body.idempotencyKey,
            payload: { ...body },
        });
        return inventoryErrors.run(() =>
            this.writes.run({
                organizationId,
                authorize: () => this.facilities.authorize(this.subject(), organizationId, input),
                execute: async () => {
                    const execution = await this.idempotency.run(
                        prepared,
                        async () => {
                            const { layout, items, workspaceIds, fingerprint } = await this.inspect(
                                organizationId,
                                input,
                                true
                            );
                            if (fingerprint !== body.expectedFingerprint)
                                throw new InventoryError({ reason: 'conflict' });
                            const operation = await this.reservations.row(prepared);
                            const nodeIds = items.map((item) => item.storageNodeId);
                            const before = await this.facilities.locations(organizationId, nodeIds);
                            await this.facilities.apply(layout);
                            const after = await this.facilities.locations(organizationId, nodeIds);
                            await this.database.queryClient.stockItem.updateMany({
                                where: {
                                    organizationId,
                                    id: { in: items.map((i) => i.stockItemId) },
                                },
                                data: { version: { increment: 1 } },
                            });
                            for (const workspaceId of workspaceIds) {
                                const selected = items.filter(
                                    (item) => item.workspaceId === workspaceId
                                );
                                await this.database.queryClient.inventoryTransaction.create({
                                    data: {
                                        organizationId,
                                        workspaceId,
                                        operationId: operation.id,
                                        actorUserId: this.subject().userId,
                                        type: 'CONTAINER_RELOCATION',
                                        reason: body.reason,
                                        lines: {
                                            create: selected.map((item, index) => {
                                                const from = before.get(item.storageNodeId);
                                                const to = after.get(item.storageNodeId);
                                                if (!from || !to)
                                                    throw new Error(
                                                        'Relocation location snapshot is missing'
                                                    );
                                                return {
                                                    stockItemId: item.stockItemId,
                                                    lineNumber: index + 1,
                                                    quantityBefore: item.stockItem.quantity,
                                                    quantityAfter: item.stockItem.quantity,
                                                    statusBefore: item.stockItem.status,
                                                    statusAfter: item.stockItem.status,
                                                    unitSnapshot:
                                                        item.stockItem.instance.material
                                                            .quantityUnit,
                                                    fromNodeId: item.storageNodeId,
                                                    toNodeId: item.storageNodeId,
                                                    fromNodePathSnapshot: from.path,
                                                    toNodePathSnapshot: to.path,
                                                    fromFacilityIdSnapshot: from.facilityId,
                                                    toFacilityIdSnapshot: to.facilityId,
                                                    fromTopologyIdSnapshot: from.topologyId,
                                                    toTopologyIdSnapshot: to.topologyId,
                                                    fromCustodianUserId:
                                                        item.stockItem.custodianUserId,
                                                    toCustodianUserId:
                                                        item.stockItem.custodianUserId,
                                                };
                                            }),
                                        },
                                    },
                                });
                                await this.audit.record({
                                    organizationId,
                                    workspaceId,
                                    actorUserId: this.subject().userId,
                                    action: 'inventory.container.relocate',
                                    occurredAt: new Date(),
                                    resources: [
                                        {
                                            resourceId: layout.root.resourceId,
                                            labelSnapshot: layout.root.name,
                                        },
                                    ],
                                    details: {
                                        operationId: operation.id,
                                        count: selected.length,
                                        reason: body.reason,
                                        fromFacilityId: layout.source.id,
                                        toFacilityId: layout.target.id,
                                    },
                                });
                            }
                            await this.audit.record({
                                organizationId,
                                actorUserId: this.subject().userId,
                                action: 'storage.stocked.relocate',
                                occurredAt: new Date(),
                                resources: [
                                    {
                                        resourceId: layout.root.resourceId,
                                        labelSnapshot: layout.root.name,
                                    },
                                ],
                                details: {
                                    operationId: operation.id,
                                    fromFacilityId: layout.source.id,
                                    toFacilityId: layout.target.id,
                                    fromTopologyId: layout.sourceLayout.id,
                                    toTopologyId: layout.targetLayout.id,
                                    itemCount: items.length,
                                    workspaceCount: workspaceIds.length,
                                    reason: body.reason,
                                },
                            });
                            return {
                                operationId: operation.id,
                                kind: 'inventory.relocate' as const,
                                stockItemId: null,
                                instanceId: null,
                                nodeId: layout.root.id,
                            };
                        },
                        operationCodec
                    );
                    if (execution.kind === 'replayed')
                        await this.inventory.authorizeOperation(
                            organizationId,
                            execution.value.operationId,
                            p.transfer
                        );
                    return execution.value;
                },
            })
        );
    }
}
