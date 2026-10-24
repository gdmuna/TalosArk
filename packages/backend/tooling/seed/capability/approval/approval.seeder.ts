import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
    ApprovalSubmitSchema,
    ApprovalReceiptSchema,
    ApprovalDecisionSchema,
    ApprovalCommandSchema,
    ApprovalExecuteSchema,
    ApprovalExecutionReceiptSchema,
} from '@talos-ark/contracts/approval';
import { ApprovalService } from '../../../../src/modules/approval/application/approval.service.js';
import { ApprovalExecutionService } from '../../../../src/modules/approval/application/approval-execution.service.js';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import { approvalKind } from './approval.kind.js';
import { seedHash } from '../../definition/value.js';
import { type BusinessSeeder } from '../../runtime/handler.js';
import type { SeedExecution } from '../../runtime/execution.js';

@Injectable()
export class ApprovalSeeder implements BusinessSeeder<typeof approvalKind> {
    constructor(
        private readonly approvals: ApprovalService,
        private readonly executor: ApprovalExecutionService,
        private readonly database: DatabaseRuntime
    ) {}

    async seed(
        data: z.output<typeof approvalKind.data>,
        input: z.output<typeof approvalKind.input>,
        execution: SeedExecution
    ) {
        const { organizationId, workspaceId, actorUserId } = input.receipt.scope;
        const scope = { organizationId, workspaceId };
        if (!input.reviewer.active || actorUserId === input.reviewer.userId)
            throw new Error('Approval seed requires an active, distinct reviewer');
        const output: z.output<typeof approvalKind.output> = {};
        const snapshot = (id: string) =>
            this.database.queryClient.approvalRequest.findUniqueOrThrow({
                where: { id },
                include: {
                    lines: { orderBy: { lineNumber: 'asc' } },
                    events: { orderBy: { id: 'asc' } },
                },
            });
        const key = (scenario: string, operation: string) =>
            `seed:${seedHash([execution.namespace, execution.step, scenario, operation])}`;
        for (const item of data.scenarios) {
            const requestId = await execution.record({
                key: `submit/${item.key}`,
                output: z.uuid(),
                create: async () => {
                    const lines = item.stockIndices.map((index) => {
                        const stock = input.receipt.stocks[index];
                        if (!stock) throw new Error(`Missing approval stock index ${index}`);
                        if (item.type === 'CONSUME')
                            return {
                                type: item.type,
                                stockItemId: stock.stockItemId,
                                quantity: '1',
                            } satisfies z.input<typeof ApprovalSubmitSchema>['lines'][number];
                        const nodeId =
                            item.targetPosition === undefined
                                ? undefined
                                : input.facility.positions[item.targetPosition];
                        if (!nodeId) throw new Error('Missing approval destination');
                        return {
                            type: item.type,
                            stockItemId: stock.stockItemId,
                            destination: {
                                facilityId: input.facility.facilityId,
                                topologyId: input.facility.topologyId,
                                nodeId,
                            },
                        } satisfies z.input<typeof ApprovalSubmitSchema>['lines'][number];
                    });
                    const request = {
                        type: item.type,
                        lines,
                        approverId: input.reviewer.userId,
                        title: `Seed ${item.key}`,
                        description: `Scenario: ${item.outcome}`,
                        idempotencyKey: key(item.key, 'submit'),
                    } satisfies z.input<typeof ApprovalSubmitSchema>;
                    return (await this.approvals.submit(scope, ApprovalSubmitSchema.parse(request)))
                        .requestId;
                },
                inspect: snapshot,
            });
            output[item.key] = requestId;
            if (item.outcome === 'pending') continue;
            if (item.outcome === 'withdrawn') {
                await execution.record({
                    key: `withdraw/${item.key}`,
                    output: ApprovalReceiptSchema,
                    create: async () => {
                        const current = await snapshot(requestId);
                        const request = {
                            expectedVersion: current.version,
                            idempotencyKey: key(item.key, 'withdraw'),
                        } satisfies z.input<typeof ApprovalCommandSchema>;
                        return this.approvals.withdraw(
                            scope,
                            requestId,
                            ApprovalCommandSchema.parse(request)
                        );
                    },
                    inspect: (value) => snapshot(value.requestId),
                });
                continue;
            }
            await execution.asActor(input.reviewer.userId, () =>
                execution.record({
                    key: `decide/${item.key}`,
                    output: ApprovalReceiptSchema,
                    create: async () => {
                        const current = await snapshot(requestId);
                        const request = {
                            expectedVersion: current.version,
                            idempotencyKey: key(item.key, 'decide'),
                            lines: current.lines.map((line, index) => ({
                                lineId: line.id,
                                decision:
                                    item.outcome === 'rejected' ||
                                    (item.outcome === 'mixed' && index > 0)
                                        ? ('REJECTED' as const)
                                        : ('APPROVED' as const),
                            })),
                        } satisfies z.input<typeof ApprovalDecisionSchema>;
                        return this.approvals.decide(
                            scope,
                            requestId,
                            ApprovalDecisionSchema.parse(request)
                        );
                    },
                    inspect: (value) => snapshot(value.requestId),
                })
            );
            if (!['executed', 'abandoned', 'revoked'].includes(item.outcome)) continue;
            if (item.outcome === 'executed') {
                await execution.record({
                    key: `execute/${item.key}`,
                    output: ApprovalExecutionReceiptSchema,
                    create: async () => {
                        const current = await snapshot(requestId);
                        const line = current.lines[0];
                        const request = {
                            expectedVersion: line.version,
                            idempotencyKey: key(item.key, 'execute'),
                        } satisfies z.input<typeof ApprovalExecuteSchema>;
                        return this.executor.execute(
                            scope,
                            requestId,
                            line.id,
                            ApprovalExecuteSchema.parse(request)
                        );
                    },
                    inspect: async (value) => ({
                        request: await snapshot(value.requestId),
                        operation:
                            await this.database.queryClient.inventoryOperation.findUniqueOrThrow({
                                where: { id: value.receipt.operationId },
                            }),
                    }),
                });
            } else {
                const outcome = item.outcome;
                await execution.asActor(
                    outcome === 'revoked' ? input.reviewer.userId : actorUserId,
                    () =>
                        execution.record({
                            key: `finish/${item.key}`,
                            output: ApprovalReceiptSchema,
                            create: async () => {
                                const current = await snapshot(requestId);
                                const line = current.lines[0];
                                const request = {
                                    expectedVersion: line.version,
                                    idempotencyKey: key(item.key, outcome),
                                    note: 'Seed terminal transition',
                                } satisfies z.input<typeof ApprovalCommandSchema>;
                                return this.approvals.finish(
                                    scope,
                                    requestId,
                                    line.id,
                                    outcome === 'revoked' ? 'revoke' : 'abandon',
                                    ApprovalCommandSchema.parse(request)
                                );
                            },
                            inspect: (value) => snapshot(value.requestId),
                        })
                );
            }
        }
        await execution.record({
            key: 'final-states',
            output: z.boolean(),
            create: async () => true,
            inspect: async () => {
                const states = [];
                for (const scenario of data.scenarios) {
                    const request = await snapshot(output[scenario.key]);
                    const expectedStatus =
                        scenario.outcome === 'pending'
                            ? 'PENDING'
                            : scenario.outcome === 'withdrawn'
                              ? 'WITHDRAWN'
                              : 'DECIDED';
                    const expectedExecution =
                        scenario.outcome === 'executed'
                            ? 'EXECUTED'
                            : scenario.outcome === 'abandoned'
                              ? 'ABANDONED'
                              : scenario.outcome === 'revoked'
                                ? 'REVOKED'
                                : 'PENDING';
                    if (
                        request.status !== expectedStatus ||
                        (request.status === 'DECIDED' &&
                            request.lines.some((line, index) => {
                                const rejected =
                                    scenario.outcome === 'rejected' ||
                                    (scenario.outcome === 'mixed' && index > 0);
                                return (
                                    line.decision !== (rejected ? 'REJECTED' : 'APPROVED') ||
                                    line.executionStatus !== (rejected ? null : expectedExecution)
                                );
                            }))
                    )
                        throw new Error(`Unexpected approval final state: ${scenario.key}`);
                    states.push({
                        id: request.id,
                        status: request.status,
                        lines: request.lines.map((line) => ({
                            id: line.id,
                            decision: line.decision,
                            executionStatus: line.executionStatus,
                        })),
                    });
                }
                return states;
            },
        });
        return output;
    }
}
