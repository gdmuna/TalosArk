import { Injectable } from '@nestjs/common';
import {
    ApprovalExecuteSchema,
    type ApprovalScope,
    type ApprovalExecute,
} from '@talos-ark/contracts/approval';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { FacilityPositionReader } from '@/modules/facility/public/index.js';
import {
    InventoryActionReader,
    InventoryActionWriter,
    formatInventoryQuantity,
} from '@/modules/inventory/public/index.js';
import { ApprovalAccessService } from './approval-access.service.js';
import { ApprovalService } from './approval.service.js';
import { ApprovalError } from './approval.error.js';
import { approvalErrors } from './approval.error.mapper.js';

@Injectable()
export class ApprovalExecutionService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly writes: OrganizationWriteKernel,
        private readonly access: ApprovalAccessService,
        private readonly approval: ApprovalService,
        private readonly inventory: InventoryActionReader,
        private readonly writer: InventoryActionWriter,
        private readonly positions: FacilityPositionReader
    ) {}
    execute(scope: ApprovalScope, requestId: string, lineId: string, input: ApprovalExecute) {
        const body = ApprovalExecuteSchema.parse(input);
        return approvalErrors.run(() =>
            this.writes.run({
                organizationId: scope.organizationId,
                authorize: () => this.access.document(scope, requestId),
                execute: async (request) => {
                    if (request.requesterId !== this.access.subject().userId)
                        throw new ApprovalError({ reason: 'forbidden' });
                    const line = await this.database.queryClient.approvalLine.findFirst({
                        where: { ...scope, requestId, id: lineId },
                    });
                    if (!line) throw new ApprovalError({ reason: 'forbidden' });
                    const result = await this.writer.granted(scope, lineId, body, async () => {
                        await this.access.require(scope, this.access.action(request.type, 'apply'));
                        if (
                            request.status !== 'DECIDED' ||
                            line.decision !== 'APPROVED' ||
                            line.executionStatus !== 'PENDING'
                        )
                            throw new ApprovalError({ reason: 'state' });
                        if (line.version !== body.expectedVersion)
                            throw new ApprovalError({ reason: 'conflict' });
                        const fact = (
                            await this.inventory.read(this.access.subject(), scope, [
                                line.stockItemId,
                            ])
                        ).get(line.stockItemId);
                        if (!fact) throw new Error('Inventory facts omitted an approved item');
                        if (
                            !fact.source ||
                            fact.source.nodeId !== line.sourceNodeId ||
                            fact.source.facilityId !== line.sourceFacilityId
                        )
                            throw new ApprovalError({ reason: 'binding' });
                        const common = {
                            expectedVersion: fact.stock.version,
                            idempotencyKey: body.idempotencyKey,
                            reason: line.note ?? '',
                        };
                        if (request.type === 'CONSUME') {
                            if (!line.quantity)
                                throw new Error('Approved consumption has no quantity');
                            return {
                                stockItemId: line.stockItemId,
                                command: {
                                    kind: 'consume' as const,
                                    body: {
                                        ...common,
                                        quantity: formatInventoryQuantity(line.quantity),
                                    },
                                },
                            };
                        }
                        if (!line.destinationNodeId)
                            throw new Error('Approved transfer has no destination');
                        const destination = (
                            await this.positions.inspectSources({
                                organizationId: scope.organizationId,
                                nodeIds: [line.destinationNodeId],
                            })
                        ).get(line.destinationNodeId);
                        if (!destination)
                            throw new Error('Approved destination has no current position facts');
                        if (destination.facilityId !== line.destinationFacilityId)
                            throw new ApprovalError({ reason: 'binding' });
                        return {
                            stockItemId: line.stockItemId,
                            command: {
                                kind: 'transfer' as const,
                                body: {
                                    ...common,
                                    position: {
                                        nodeId: destination.nodeId,
                                        facilityId: destination.facilityId,
                                        topologyId: destination.topologyId,
                                    },
                                },
                            },
                        };
                    });
                    if (result.kind === 'executed') {
                        const changed = await this.database.queryClient.approvalLine.updateMany({
                            where: {
                                ...scope,
                                id: lineId,
                                version: body.expectedVersion,
                                decision: 'APPROVED',
                                executionStatus: 'PENDING',
                            },
                            data: {
                                executionStatus: 'EXECUTED',
                                terminalAt: new Date(),
                                version: { increment: 1 },
                            },
                        });
                        if (changed.count !== 1) throw new ApprovalError({ reason: 'conflict' });
                        await this.approval.event(request, 'EXECUTED', '', lineId);
                    }
                    return { requestId, lineId, receipt: result.value };
                },
            })
        );
    }
}
