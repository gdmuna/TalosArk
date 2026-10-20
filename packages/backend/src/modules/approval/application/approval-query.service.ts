import { Injectable } from '@nestjs/common';
import type { Prisma, ApprovalRequest } from '@root/prisma/generated/client.js';
import {
    ApprovalSelectionSchema,
    ApprovalReceiptSchema,
    type ApprovalScope,
    type ApprovalQuery,
    type ApprovalPageQuery,
    type ApprovalSelection,
} from '@talos-ark/contracts/approval';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { FacilityPositionReader } from '@/modules/facility/public/index.js';
import {
    InventoryActionReader,
    type InventoryActionFact,
    InventoryOperationService,
    formatInventoryQuantity,
} from '@/modules/inventory/public/index.js';
import { approvalPermission as p } from '../contribution/approval-authorization.contribution.js';
import { approvalProgress } from '../domain/approval.js';
import { ApprovalAccessService } from './approval-access.service.js';
import { ApprovalService } from './approval.service.js';
import { ApprovalError } from './approval.error.js';

@Injectable()
export class ApprovalQueryService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly access: ApprovalAccessService,
        private readonly approval: ApprovalService,
        private readonly inventory: InventoryActionReader,
        private readonly operations: InventoryOperationService,
        private readonly positions: FacilityPositionReader
    ) {}
    read<T>(work: () => Promise<T>) {
        return this.database.transaction.run(
            work,
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }
    context(scope: ApprovalScope) {
        return this.read(async () => ({ capabilities: await this.access.capabilities(scope) }));
    }
    candidates(scope: ApprovalScope, input: ApprovalSelection) {
        const body = ApprovalSelectionSchema.parse(input);
        return this.read(async () => {
            await this.access.context(scope);
            const lines = await this.approval.prepare(scope, body);
            const members = await this.database.queryClient.workspaceMember.findMany({
                where: { ...scope, status: 'ACTIVE', organizationMember: { status: 'ACTIVE' } },
                include: {
                    organizationMember: { include: { user: { include: { profile: true } } } },
                },
                orderBy: { id: 'asc' },
            });
            const items = [];
            for (const member of members) {
                const user = member.organizationMember.user;
                if (
                    await this.approval.qualified(scope, body.type, lines, {
                        kind: 'user',
                        userId: user.id,
                    })
                )
                    items.push({
                        userId: user.id,
                        username: user.username,
                        name: user.profile?.nickname || user.username,
                    });
            }
            return { items };
        });
    }
    private async requestView(scope: ApprovalScope, row: ApprovalRequest) {
        const users = await this.database.queryClient.user.findMany({
            where: { id: { in: [row.requesterId, row.approverId] } },
            select: { id: true, username: true, profile: { select: { nickname: true } } },
        });
        const names = new Map(
            users.map((user) => [user.id, user.profile?.nickname || user.username])
        );
        const lines = await this.database.queryClient.approvalLine.findMany({
            where: { ...scope, requestId: row.id },
            select: {
                decision: true,
                executionStatus: true,
                sourceFacilityId: true,
                destinationFacilityId: true,
            },
        });
        const readable = await this.access.stockReadable(scope);
        const facilityIds = [
            ...new Set(
                lines.flatMap((line) => [
                    line.sourceFacilityId,
                    ...(line.destinationFacilityId ? [line.destinationFacilityId] : []),
                ])
            ),
        ];
        const usable =
            readable && row.approverId === this.access.subject().userId && row.status === 'PENDING'
                ? await this.positions.usableFacilities(this.access.subject(), scope, facilityIds)
                : new Set<string>();
        return {
            id: row.id,
            resourceId: row.resourceId,
            ...scope,
            type: row.type,
            title: readable ? row.title : row.type === 'CONSUME' ? '消耗申请' : '转移申请',
            description: readable ? (row.description ?? '') : '',
            requesterId: row.requesterId,
            approverId: row.approverId,
            requesterName: names.get(row.requesterId) ?? '',
            approverName: names.get(row.approverId) ?? '',
            previousId: row.previousId,
            status: row.status,
            version: row.version,
            createdAt: row.createdAt.toISOString(),
            decidedAt: row.decidedAt?.toISOString() ?? null,
            ...approvalProgress(lines),
            actions: {
                decide:
                    row.status === 'PENDING' &&
                    row.approverId === this.access.subject().userId &&
                    readable &&
                    facilityIds.every((id) => usable.has(id)) &&
                    (await this.access.can(scope, this.access.action(row.type, 'review'))),
                withdraw:
                    row.status === 'PENDING' && row.requesterId === this.access.subject().userId,
            },
        };
    }
    list(scope: ApprovalScope, query: ApprovalQuery) {
        return this.read(async () => {
            await this.access.context(scope);
            if (query.view === 'all') await this.access.require(scope, p.readAll);
            const userId = this.access.subject().userId;
            const where: Prisma.ApprovalRequestWhereInput = {
                ...scope,
                ...(query.status ? { AND: [{ status: query.status }] } : {}),
                ...(query.view === 'mine'
                    ? { requesterId: userId }
                    : query.view === 'review'
                      ? { approverId: userId, status: 'PENDING' }
                      : query.view === 'execute'
                        ? {
                              requesterId: userId,
                              status: 'DECIDED',
                              lines: { some: { executionStatus: 'PENDING' } },
                          }
                        : {}),
            };
            const rows = await this.database.queryClient.approvalRequest.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            });
            const total = await this.database.queryClient.approvalRequest.count({ where });
            const items = [];
            for (const row of rows) items.push(await this.requestView(scope, row));
            return { items, total, page: query.page, pageSize: query.pageSize };
        });
    }
    get(scope: ApprovalScope, id: string) {
        return this.read(async () =>
            this.requestView(scope, await this.access.document(scope, id))
        );
    }
    summary(scope: ApprovalScope) {
        return this.read(async () => {
            await this.access.context(scope);
            const userId = this.access.subject().userId;
            return {
                pendingReview: await this.database.queryClient.approvalRequest.count({
                    where: { ...scope, approverId: userId, status: 'PENDING' },
                }),
                pendingExecution: await this.database.queryClient.approvalLine.count({
                    where: {
                        ...scope,
                        executionStatus: 'PENDING',
                        request: { requesterId: userId, status: 'DECIDED' },
                    },
                }),
            };
        });
    }
    lines(scope: ApprovalScope, requestId: string, query: ApprovalPageQuery) {
        return this.read(async () => {
            const request = await this.access.document(scope, requestId);
            const rows = await this.database.queryClient.approvalLine.findMany({
                where: { ...scope, requestId },
                orderBy: { lineNumber: 'asc' },
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: { execution: { select: { id: true, operationId: true } } },
            });
            const readable = await this.access.stockReadable(scope);
            const facts: Map<string, InventoryActionFact> = readable
                ? await this.inventory.read(
                      this.access.subject(),
                      scope,
                      rows.map((line) => line.stockItemId)
                  )
                : new Map();
            const boundNodes = rows.flatMap((line) => [
                line.sourceNodeId,
                ...(line.destinationNodeId ? [line.destinationNodeId] : []),
            ]);
            const locations: Awaited<ReturnType<FacilityPositionReader['describeMany']>> = readable
                ? await this.positions.describeMany(this.access.subject(), {
                      ...scope,
                      nodeIds: boundNodes,
                  })
                : new Map();
            const allSources: Awaited<ReturnType<FacilityPositionReader['inspectSources']>> =
                readable
                    ? await this.positions.inspectSources({
                          organizationId: scope.organizationId,
                          nodeIds: boundNodes,
                      })
                    : new Map();
            const facilityIds = rows.flatMap((line) => [
                line.sourceFacilityId,
                ...(line.destinationFacilityId ? [line.destinationFacilityId] : []),
            ]);
            const usable = readable
                ? await this.positions.usableFacilities(this.access.subject(), scope, facilityIds)
                : new Set<string>();
            const occupied = new Set(
                (readable
                    ? await this.database.queryClient.placement.findMany({
                          where: {
                              organizationId: scope.organizationId,
                              storageNodeId: {
                                  in: rows.flatMap((line) =>
                                      line.destinationNodeId ? [line.destinationNodeId] : []
                                  ),
                              },
                          },
                          select: { storageNodeId: true },
                      })
                    : []
                ).map((row) => row.storageNodeId)
            );
            const apply = await this.access.can(scope, this.access.action(request.type, 'apply'));
            const review = await this.access.can(scope, this.access.action(request.type, 'review'));
            const revoke = await this.access.can(scope, p.revoke);
            const items = rows.map((line) => {
                const fact = facts.get(line.stockItemId);
                const sourceFact = allSources.get(line.sourceNodeId);
                const destinationFact = line.destinationNodeId
                    ? allSources.get(line.destinationNodeId)
                    : null;
                const source =
                    sourceFact?.facilityId === line.sourceFacilityId
                        ? (locations.get(line.sourceNodeId) ?? null)
                        : null;
                const destination =
                    line.destinationNodeId &&
                    destinationFact?.facilityId === line.destinationFacilityId
                        ? (locations.get(line.destinationNodeId) ?? null)
                        : null;
                const pending = request.status === 'DECIDED' && line.executionStatus === 'PENDING';
                const mayUse =
                    usable.has(line.sourceFacilityId) &&
                    (!line.destinationFacilityId || usable.has(line.destinationFacilityId));
                let blockedReason: string | null = null;
                if (pending) {
                    if (!fact) blockedReason = 'resourceRestricted';
                    else if (!apply || !mayUse) blockedReason = 'permission';
                    else if (
                        fact.source?.nodeId !== line.sourceNodeId ||
                        fact.source?.facilityId !== line.sourceFacilityId ||
                        (line.destinationNodeId &&
                            destinationFact?.facilityId !== line.destinationFacilityId)
                    )
                        blockedReason = 'binding';
                    else
                        blockedReason = this.inventory.blocked(
                            fact,
                            line.quantity !== null
                                ? {
                                      kind: 'consume',
                                      quantity: formatInventoryQuantity(line.quantity),
                                  }
                                : { kind: 'transfer' }
                        );
                    if (!blockedReason && destinationFact && !destinationFact.writable)
                        blockedReason = 'state';
                    if (
                        !blockedReason &&
                        line.destinationNodeId &&
                        occupied.has(line.destinationNodeId)
                    )
                        blockedReason = 'occupied';
                }
                return {
                    id: line.id,
                    lineNumber: line.lineNumber,
                    version: line.version,
                    decision: line.decision,
                    opinion: readable ? (line.opinion ?? '') : '',
                    executionStatus: line.executionStatus,
                    terminalAt: line.terminalAt?.toISOString() ?? null,
                    stock: fact
                        ? {
                              stockItemId: fact.stock.id,
                              instanceId: fact.stock.instanceId,
                              code: fact.stock.code,
                              materialName: fact.stock.materialName,
                              quantity: fact.stock.quantity,
                              quantityUnit: fact.stock.quantityUnit,
                              quantityScale: fact.stock.quantityScale,
                          }
                        : null,
                    requestedQuantity:
                        readable && line.quantity ? formatInventoryQuantity(line.quantity) : null,
                    source,
                    destination,
                    locationRestricted: !source || (!!line.destinationNodeId && !destination),
                    note: readable ? (line.note ?? '') : '',
                    operationId: readable ? (line.execution?.operationId ?? null) : null,
                    transactionId: readable ? (line.execution?.id ?? null) : null,
                    blockedReason,
                    actions: {
                        execute:
                            pending &&
                            request.requesterId === this.access.subject().userId &&
                            !blockedReason,
                        abandon: pending && request.requesterId === this.access.subject().userId,
                        revoke:
                            pending &&
                            readable &&
                            (revoke ||
                                (request.approverId === this.access.subject().userId &&
                                    review &&
                                    mayUse)),
                    },
                };
            });
            return {
                items,
                total: await this.database.queryClient.approvalLine.count({
                    where: { ...scope, requestId },
                }),
                page: query.page,
                pageSize: query.pageSize,
            };
        });
    }
    operation(scope: ApprovalScope, operationId: string) {
        return this.read(async () => {
            await this.access.context(scope);
            const row = await this.database.queryClient.approvalOperation.findFirst({
                where: {
                    ...scope,
                    id: operationId,
                    actorUserId: this.access.subject().userId,
                    completedAt: { not: null },
                },
            });
            if (row) {
                const receipt = ApprovalReceiptSchema.safeParse(row.result);
                if (!receipt.success)
                    throw new ApprovalError({ reason: 'result' }, { cause: receipt.error });
                await this.access.document(scope, receipt.data.requestId);
                return { kind: 'approval' as const, receipt: receipt.data };
            }
            const transaction = await this.database.queryClient.inventoryTransaction.findFirst({
                where: { ...scope, operationId, approvalLineId: { not: null } },
                include: { approval: true },
            });
            if (!transaction?.approval) throw new ApprovalError({ reason: 'forbidden' });
            await this.access.document(scope, transaction.approval.requestId);
            await this.access.requireStockRead(scope);
            const receipt = await this.operations.operation(scope.organizationId, operationId);
            return {
                kind: 'inventory' as const,
                receipt: {
                    requestId: transaction.approval.requestId,
                    lineId: transaction.approval.id,
                    receipt,
                },
            };
        });
    }
    events(scope: ApprovalScope, requestId: string, query: ApprovalPageQuery) {
        return this.read(async () => {
            await this.access.document(scope, requestId);
            const readable = await this.access.stockReadable(scope);
            const where = { ...scope, requestId };
            const rows = await this.database.queryClient.approvalEvent.findMany({
                where,
                include: {
                    actor: { select: { username: true, profile: { select: { nickname: true } } } },
                },
                orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            });
            return {
                items: rows.map((row) => ({
                    id: row.id,
                    lineId: row.lineId,
                    action: row.action,
                    actorUserId: row.actorUserId,
                    actorName: row.actor.profile?.nickname || row.actor.username,
                    occurredAt: row.occurredAt.toISOString(),
                    note: readable ? (row.note ?? '') : '',
                })),
                total: await this.database.queryClient.approvalEvent.count({ where }),
                page: query.page,
                pageSize: query.pageSize,
            };
        });
    }
}
