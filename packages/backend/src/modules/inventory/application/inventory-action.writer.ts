import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
    InventoryAction,
    InventoryScope,
    OperationReceipt,
} from '@talos-ark/contracts/inventory';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuditKernel } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { FacilityPositionReader } from '@/modules/facility/public/index.js';
import { expiryValue } from '@/modules/material/public/index.js';
import { InventoryCalendar } from '../domain/inventory-calendar.js';
import { planInventoryAction } from '../domain/inventory-action.js';
import {
    formatInventoryQuantity,
    parseInventoryQuantity,
} from '../domain/value-objects/inventory-quantity.js';
import { InventoryAccessService } from './inventory-access.service.js';
import { InventoryError } from './inventory.error.js';
import { IdempotencyKernel } from '@/core/idempotency/index.js';
import { InventoryIdempotencyRepository } from '../infrastructure/persistence/inventory-idempotency.repository.js';
import { InventoryOperationService, operationCodec } from './inventory-operation.service.js';
import { inventoryErrors } from './inventory.error.mapper.js';

/** Trusted application boundary: caller authorizes the action under the organization write lock. */
@Injectable()
export class InventoryActionWriter {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly access: InventoryAccessService,
        private readonly positions: FacilityPositionReader,
        private readonly calendar: InventoryCalendar,
        private readonly actor: AlsContextAdapter,
        private readonly audit: AuditKernel,
        private readonly idempotency: IdempotencyKernel,
        private readonly reservations: InventoryIdempotencyRepository,
        private readonly operations: InventoryOperationService
    ) {}
    private subject() {
        return { kind: 'user' as const, userId: this.actor.requireActor().userId };
    }
    /** Resolve trusted granted intent only for a new write; replay needs current read authority. */
    granted(
        scope: InventoryScope,
        lineId: string,
        request: { expectedVersion: number; idempotencyKey: string },
        resolve: () => Promise<{ stockItemId: string; command: InventoryAction }>
    ) {
        return inventoryErrors.run(() =>
            this.database.transaction.run(
                async () => {
                    await this.access.require(this.subject(), scope);
                    const prepared = this.idempotency.prepare({
                        scope: { kind: 'workspace', ...scope },
                        operation: 'approval.execute',
                        key: request.idempotencyKey,
                        payload: { actorUserId: this.subject().userId, lineId, ...request },
                    });
                    const result = await this.idempotency.run(
                        prepared,
                        async () => {
                            const intent = await resolve();
                            const operation = await this.reservations.row(prepared);
                            return this.write(
                                scope,
                                intent.stockItemId,
                                intent.command,
                                operation.id,
                                lineId
                            );
                        },
                        operationCodec
                    );
                    const operation = await this.operations.authorizeOperation(
                        scope.organizationId,
                        result.value.operationId
                    );
                    return {
                        ...result,
                        value: await this.operations.project(result.value, operation),
                    };
                },
                { propagation: 'mandatory' }
            )
        );
    }
    write(
        scope: InventoryScope,
        stockItemId: string,
        command: InventoryAction,
        operationId: string,
        approvalLineId?: string
    ) {
        return this.database.transaction.run(
            async (): Promise<OperationReceipt> => {
                await this.access.require(this.subject(), scope);
                const kind = command.kind;
                const action: Parameters<typeof planInventoryAction>[1] =
                    command.kind === 'consume'
                        ? {
                              kind: 'consume',
                              quantity: parseInventoryQuantity(command.body.quantity),
                          }
                        : command.kind === 'adjust'
                          ? {
                                kind: 'adjust',
                                quantity: parseInventoryQuantity(command.body.actualQuantity),
                            }
                          : command.kind === 'transfer'
                            ? { kind: 'transfer' }
                            : { kind: 'dispose' };
                const stock = await this.database.queryClient.stockItem.findFirst({
                    where: { ...scope, id: stockItemId },
                    include: {
                        instance: { include: { material: true } },
                        placement: true,
                    },
                });
                if (!stock) throw new InventoryError({ reason: 'forbidden' });
                if (stock.version !== command.body.expectedVersion)
                    throw new InventoryError({ reason: 'conflict' });
                const occurredAt = new Date();
                const plan = planInventoryAction(
                    {
                        quantity: stock.quantity,
                        status: stock.status,
                        quantityScale: stock.instance.material.quantityScale,
                        expired:
                            this.calendar.risk(
                                expiryValue(stock.instance),
                                this.calendar.today(occurredAt)
                            ) === 'EXPIRED',
                    },
                    action
                );
                if (!plan.ok) throw new InventoryError({ reason: plan.reason });
                if (!stock.placement) throw new Error('Managed stock has no current placement');
                const from = (
                    await this.positions.inspectSources({
                        organizationId: scope.organizationId,
                        nodeIds: [stock.placement.storageNodeId],
                    })
                ).get(stock.placement.storageNodeId);
                if (!from) throw new Error('Managed stock source position was not inspected');
                if (!from.writable) throw new InventoryError({ reason: 'state' });
                if (kind !== 'adjust')
                    await this.positions.requireUse(this.subject(), scope, [from.facilityId]);
                let to = plan.placement === 'release' ? null : from;
                if (command.kind === 'transfer') {
                    if (command.body.position.nodeId === from.nodeId)
                        throw new InventoryError({ reason: 'invalid' });
                    to = {
                        ...(
                            await this.positions.requireAvailable({
                                ...scope,
                                ...command.body.position,
                                subject: this.subject(),
                            })
                        ).location,
                        writable: true,
                    };
                }
                const changed = await this.database.queryClient.stockItem.updateMany({
                    where: {
                        ...scope,
                        id: stock.id,
                        version: command.body.expectedVersion,
                    },
                    data: {
                        quantity: plan.quantity,
                        status: plan.status,
                        version: { increment: 1 },
                    },
                });
                if (changed.count !== 1) throw new InventoryError({ reason: 'conflict' });
                if (plan.placement === 'move') {
                    if (!to) throw new Error('Stock transfer has no destination');
                    await this.database.queryClient.placement.update({
                        where: {
                            organizationId_workspaceId_stockItemId: {
                                ...scope,
                                stockItemId: stock.id,
                            },
                        },
                        data: { storageNodeId: to.nodeId, placedAt: occurredAt },
                    });
                } else if (plan.placement === 'release')
                    await this.database.queryClient.placement.delete({
                        where: {
                            organizationId_workspaceId_stockItemId: {
                                ...scope,
                                stockItemId: stock.id,
                            },
                        },
                    });
                await this.database.queryClient.inventoryTransaction.create({
                    data: {
                        ...scope,
                        operationId,
                        actorUserId: this.subject().userId,
                        type: plan.transactionType,
                        approvalLineId,
                        occurredAt,
                        reason: command.body.reason,
                        lines: {
                            create: {
                                stockItemId: stock.id,
                                lineNumber: 1,
                                unitSnapshot: stock.instance.material.quantityUnit,
                                quantityBefore: stock.quantity,
                                quantityAfter: plan.quantity,
                                statusBefore: stock.status,
                                statusAfter: plan.status,
                                fromNodeId: from.nodeId,
                                toNodeId: to?.nodeId ?? null,
                                fromNodePathSnapshot: from.path,
                                toNodePathSnapshot: to?.path ?? null,
                                fromFacilityIdSnapshot: from.facilityId,
                                toFacilityIdSnapshot: to?.facilityId ?? null,
                                fromTopologyIdSnapshot: from.topologyId,
                                toTopologyIdSnapshot: to?.topologyId ?? null,
                                fromCustodianUserId: stock.custodianUserId,
                                toCustodianUserId: stock.custodianUserId,
                            },
                        },
                    },
                });
                await this.audit.record({
                    ...scope,
                    actorUserId: this.subject().userId,
                    action: `inventory.${kind}`,
                    occurredAt,
                    requestId: this.actor.get()?.requestId,
                    resources: [
                        {
                            resourceId: stock.resourceId,
                            labelSnapshot: stock.instance.code,
                        },
                    ],
                    details: {
                        operationId,
                        stockItemId: stock.id,
                        instanceId: stock.instanceId,
                        quantityBefore: formatInventoryQuantity(stock.quantity),
                        quantityAfter: formatInventoryQuantity(plan.quantity),
                        statusBefore: stock.status,
                        statusAfter: plan.status,
                        fromFacilityId: from.facilityId,
                        toFacilityId: to?.facilityId ?? null,
                        fromNodeId: from.nodeId,
                        toNodeId: to?.nodeId ?? null,
                        reasonHash: createHash('sha256').update(command.body.reason).digest('hex'),
                    },
                });
                const identity = {
                    operationId,
                    stockItemId: stock.id,
                    instanceId: stock.instanceId,
                };
                return kind === 'dispose'
                    ? { ...identity, kind: 'inventory.dispose', nodeId: null }
                    : {
                          ...identity,
                          kind: `inventory.${kind}`,
                          nodeId: to?.nodeId ?? null,
                      };
            },
            { propagation: 'mandatory' }
        );
    }
}
