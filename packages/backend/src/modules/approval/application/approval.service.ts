import { Injectable } from '@nestjs/common';
import type { ApprovalLine, ApprovalRequest } from '@root/prisma/generated/client.js';
import {
    ApprovalSubmitSchema,
    ApprovalDecisionSchema,
    ApprovalCommandSchema,
    ApprovalReceiptSchema,
    type ApprovalScope,
    type ApprovalSelection,
    type ApprovalSubmit,
    type ApprovalDecision,
    type ApprovalCommand,
    type ApprovalReceipt,
} from '@talos-ark/contracts/approval';
import type { PermissionSubject } from '@/core/permission/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import {
    IdempotencyKernel,
    type IdempotencyResultCodec,
    type IdempotencyJsonValue,
} from '@/core/idempotency/index.js';
import { ResourceKernel } from '@/core/resource/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import { FacilityPositionReader } from '@/modules/facility/public/index.js';
import {
    InventoryActionReader,
    formatInventoryQuantity,
    parseInventoryQuantity,
} from '@/modules/inventory/public/index.js';
import { approvalPermission as p } from '../contribution/approval-authorization.contribution.js';
import { completeDecisionIds } from '../domain/approval.js';
import { ApprovalIdempotencyRepository } from '../infrastructure/persistence/approval-idempotency.repository.js';
import { ApprovalAccessService } from './approval-access.service.js';
import { ApprovalError } from './approval.error.js';
import { approvalErrors } from './approval.error.mapper.js';

const receiptCodec: IdempotencyResultCodec<ApprovalReceipt> = {
    encode: (value) => ({ ...value }),
    decode(value) {
        const parsed = ApprovalReceiptSchema.safeParse(value);
        if (!parsed.success) throw new ApprovalError({ reason: 'result' }, { cause: parsed.error });
        return parsed.data;
    },
};

@Injectable()
export class ApprovalService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly writes: OrganizationWriteKernel,
        private readonly access: ApprovalAccessService,
        private readonly inventory: InventoryActionReader,
        private readonly positions: FacilityPositionReader,
        private readonly resources: ResourceKernel,
        private readonly audit: AuditKernel,
        private readonly idempotency: IdempotencyKernel,
        private readonly reservations: ApprovalIdempotencyRepository
    ) {}
    async prepare(scope: ApprovalScope, selection: ApprovalSelection) {
        await this.access.require(scope, this.access.action(selection.type, 'apply'));
        const facts = await this.inventory.read(
            this.access.subject(),
            scope,
            selection.lines.map((line) => line.stockItemId)
        );
        const lines = [];
        for (const [index, line] of selection.lines.entries()) {
            const fact = facts.get(line.stockItemId);
            if (!fact) throw new Error('Inventory facts omitted a requested item');
            const source = this.inventory.validate(
                fact,
                line.type === 'CONSUME'
                    ? { kind: 'consume', quantity: line.quantity }
                    : { kind: 'transfer' }
            );
            await this.positions.requireUse(this.access.subject(), scope, [source.facilityId]);
            const destination =
                line.type === 'TRANSFER'
                    ? (
                          await this.positions.requireAvailable({
                              ...scope,
                              ...line.destination,
                              subject: this.access.subject(),
                          })
                      ).location
                    : null;
            if (destination && destination.nodeId === source.nodeId)
                throw new ApprovalError({ reason: 'invalid' });
            lines.push({
                stockItemId: line.stockItemId,
                lineNumber: index + 1,
                quantity: line.type === 'CONSUME' ? parseInventoryQuantity(line.quantity) : null,
                unitSnapshot: fact.stock.quantityUnit,
                codeSnapshot: fact.stock.code,
                sourceNodeId: source.nodeId,
                sourceFacilityId: source.facilityId,
                destinationNodeId: destination?.nodeId ?? null,
                destinationFacilityId: destination?.facilityId ?? null,
                note: line.note,
            });
        }
        return lines;
    }
    async qualified(
        scope: ApprovalScope,
        type: ApprovalRequest['type'],
        lines: readonly Pick<ApprovalLine, 'sourceFacilityId' | 'destinationFacilityId'>[],
        subject: PermissionSubject
    ) {
        if (
            !(await this.access.can(scope, this.access.action(type, 'review'), subject)) ||
            !(await this.access.stockReadable(scope, subject))
        )
            return false;
        if (
            subject.userId === this.access.subject().userId &&
            !(await this.access.context(scope, subject)).isSuperAdmin
        )
            return false;
        const ids = [
            ...new Set(
                lines.flatMap((line) => [
                    line.sourceFacilityId,
                    ...(line.destinationFacilityId ? [line.destinationFacilityId] : []),
                ])
            ),
        ];
        const usable = await this.positions.usableFacilities(subject, scope, ids);
        return ids.every((id) => usable.has(id));
    }
    private command(
        scope: ApprovalScope,
        kind: ApprovalReceipt['kind'],
        body: { idempotencyKey: string },
        payload: IdempotencyJsonValue,
        work: () => Promise<{ requestId: string; lineId: string | null }>
    ) {
        const prepared = this.idempotency.prepare({
            scope: { kind: 'workspace', ...scope },
            operation: kind,
            key: body.idempotencyKey,
            payload: { actorUserId: this.access.subject().userId, input: payload },
        });
        return approvalErrors.run(() =>
            this.writes.run({
                organizationId: scope.organizationId,
                authorize: () => this.access.context(scope),
                execute: async () => {
                    const result = await this.idempotency.run(
                        prepared,
                        async () => {
                            const value = await work();
                            return {
                                ...value,
                                kind,
                                operationId: (await this.reservations.row(prepared)).id,
                            };
                        },
                        receiptCodec
                    );
                    await this.access.document(scope, result.value.requestId);
                    return result.value;
                },
            })
        );
    }
    submit(scope: ApprovalScope, input: ApprovalSubmit) {
        const body = ApprovalSubmitSchema.parse(input);
        const normalized = {
            ...body,
            lines: body.lines.map((line) =>
                line.type === 'CONSUME'
                    ? {
                          ...line,
                          quantity: formatInventoryQuantity(parseInventoryQuantity(line.quantity)),
                      }
                    : line
            ),
        };
        return this.command(scope, 'approval.submit', body, normalized, async () => {
            const lines = await this.prepare(scope, body);
            const subject = { kind: 'user' as const, userId: body.approverId };
            if (!(await this.qualified(scope, body.type, lines, subject)))
                throw new ApprovalError({ reason: 'forbidden' });
            if (body.previousId) {
                const previous = await this.access.document(scope, body.previousId);
                if (
                    previous.requesterId !== this.access.subject().userId &&
                    !(await this.access.context(scope)).isSuperAdmin
                )
                    throw new ApprovalError({ reason: 'forbidden' });
            }
            const resource = await this.resources.create({
                organizationId: scope.organizationId,
                kind: 'APPROVAL_REQUEST',
            });
            const request = await this.database.queryClient.approvalRequest.create({
                data: {
                    ...scope,
                    resourceId: resource.id,
                    type: body.type,
                    title: body.title || (body.type === 'CONSUME' ? '消耗申请' : '转移申请'),
                    description: body.description,
                    requesterId: this.access.subject().userId,
                    approverId: body.approverId,
                    previousId: body.previousId,
                    lines: { create: lines },
                },
            });
            await this.event(request, 'SUBMITTED', body.description);
            return { requestId: request.id, lineId: null };
        });
    }
    decide(scope: ApprovalScope, requestId: string, input: ApprovalDecision) {
        const body = ApprovalDecisionSchema.parse(input);
        return this.command(
            scope,
            'approval.decide',
            body,
            {
                requestId,
                ...body,
                lines: [...body.lines].sort((a, b) => a.lineId.localeCompare(b.lineId)),
            },
            async () => {
                const request = await this.access.document(scope, requestId);
                if (
                    (request.approverId !== this.access.subject().userId ||
                        request.requesterId === this.access.subject().userId) &&
                    !(await this.access.context(scope)).isSuperAdmin
                )
                    throw new ApprovalError({ reason: 'forbidden' });
                await this.access.require(scope, this.access.action(request.type, 'review'));
                await this.access.requireStockRead(scope);
                const lines = await this.database.queryClient.approvalLine.findMany({
                    where: { ...scope, requestId },
                });
                const facilityIds = lines.flatMap((line) => [
                    line.sourceFacilityId,
                    ...(line.destinationFacilityId ? [line.destinationFacilityId] : []),
                ]);
                await this.positions.requireUse(this.access.subject(), scope, facilityIds);
                if (
                    !completeDecisionIds(
                        lines.map((line) => line.id),
                        body.lines
                    )
                )
                    throw new ApprovalError({ reason: 'invalid' });
                await this.transition(request, body.expectedVersion, 'PENDING', 'DECIDED');
                for (const line of body.lines)
                    await this.database.queryClient.approvalLine.update({
                        where: { id: line.lineId },
                        data: {
                            decision: line.decision,
                            opinion: line.opinion,
                            executionStatus: line.decision === 'APPROVED' ? 'PENDING' : null,
                            version: { increment: 1 },
                        },
                    });
                await this.event(request, 'DECIDED', body.note);
                return { requestId, lineId: null };
            }
        );
    }
    withdraw(scope: ApprovalScope, requestId: string, input: ApprovalCommand) {
        const body = ApprovalCommandSchema.parse(input);
        return this.command(scope, 'approval.withdraw', body, { requestId, ...body }, async () => {
            const request = await this.access.document(scope, requestId);
            if (
                request.requesterId !== this.access.subject().userId &&
                !(await this.access.context(scope)).isSuperAdmin
            )
                throw new ApprovalError({ reason: 'forbidden' });
            await this.transition(request, body.expectedVersion, 'PENDING', 'WITHDRAWN');
            await this.event(request, 'WITHDRAWN', body.note);
            return { requestId, lineId: null };
        });
    }
    finish(
        scope: ApprovalScope,
        requestId: string,
        lineId: string,
        kind: 'abandon' | 'revoke',
        input: ApprovalCommand
    ) {
        const body = ApprovalCommandSchema.parse(input);
        return this.command(
            scope,
            `approval.${kind}`,
            body,
            { requestId, lineId, ...body },
            async () => {
                const request = await this.access.document(scope, requestId);
                const line = await this.database.queryClient.approvalLine.findFirst({
                    where: { ...scope, requestId, id: lineId },
                });
                if (!line) throw new ApprovalError({ reason: 'forbidden' });
                if (kind === 'abandon') {
                    if (
                        request.requesterId !== this.access.subject().userId &&
                        !(await this.access.context(scope)).isSuperAdmin
                    )
                        throw new ApprovalError({ reason: 'forbidden' });
                } else {
                    await this.access.requireStockRead(scope);
                    if (!(await this.access.can(scope, p.revoke))) {
                        if (request.approverId !== this.access.subject().userId)
                            throw new ApprovalError({ reason: 'forbidden' });
                        await this.access.require(
                            scope,
                            this.access.action(request.type, 'review')
                        );
                        await this.positions.requireUse(this.access.subject(), scope, [
                            line.sourceFacilityId,
                            ...(line.destinationFacilityId ? [line.destinationFacilityId] : []),
                        ]);
                    }
                }
                if (
                    request.status !== 'DECIDED' ||
                    line.decision !== 'APPROVED' ||
                    line.executionStatus !== 'PENDING'
                )
                    throw new ApprovalError({ reason: 'state' });
                const changed = await this.database.queryClient.approvalLine.updateMany({
                    where: {
                        ...scope,
                        id: lineId,
                        version: body.expectedVersion,
                        executionStatus: 'PENDING',
                    },
                    data: {
                        executionStatus: kind === 'abandon' ? 'ABANDONED' : 'REVOKED',
                        terminalAt: new Date(),
                        version: { increment: 1 },
                    },
                });
                if (changed.count !== 1) throw new ApprovalError({ reason: 'conflict' });
                await this.event(
                    request,
                    kind === 'abandon' ? 'ABANDONED' : 'REVOKED',
                    body.note,
                    lineId
                );
                return { requestId, lineId };
            }
        );
    }
    private async transition(
        request: ApprovalRequest,
        version: number,
        from: 'PENDING',
        to: 'DECIDED' | 'WITHDRAWN'
    ) {
        if (request.status !== from) throw new ApprovalError({ reason: 'state' });
        const changed = await this.database.queryClient.approvalRequest.updateMany({
            where: {
                id: request.id,
                organizationId: request.organizationId,
                workspaceId: request.workspaceId,
                version,
                status: from,
            },
            data: {
                status: to,
                decidedAt: to === 'DECIDED' ? new Date() : null,
                version: { increment: 1 },
            },
        });
        if (changed.count !== 1) throw new ApprovalError({ reason: 'conflict' });
    }
    async event(
        request: ApprovalRequest,
        action: 'SUBMITTED' | 'DECIDED' | 'WITHDRAWN' | 'ABANDONED' | 'REVOKED' | 'EXECUTED',
        note: string,
        lineId?: string
    ) {
        const scope = { organizationId: request.organizationId, workspaceId: request.workspaceId };
        const occurredAt = new Date();
        await this.database.queryClient.approvalEvent.create({
            data: {
                ...scope,
                requestId: request.id,
                lineId,
                actorUserId: this.access.subject().userId,
                action,
                note,
                occurredAt,
            },
        });
        await this.audit.record({
            ...scope,
            actorUserId: this.access.subject().userId,
            action: `approval.${action.toLowerCase()}`,
            occurredAt,
            resources: [
                {
                    resourceId: request.resourceId,
                    labelSnapshot: request.type === 'CONSUME' ? '消耗申请' : '转移申请',
                },
            ],
            details: { approvalRequestId: request.id, lineId: lineId ?? null },
        });
    }
}
