import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@root/prisma/generated/client.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import type {
    IdempotencyRepository,
    IdempotencyLease,
    IdempotencyJsonValue,
    PreparedIdempotencyRequest,
    IdempotencyReservation,
} from '@/core/idempotency/index.js';

@Injectable()
export class ApprovalIdempotencyRepository implements IdempotencyRepository {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly actor: AlsContextAdapter
    ) {}
    private key(request: PreparedIdempotencyRequest) {
        if (request.scope.kind !== 'workspace')
            throw new Error('Approval receipts require workspace scope');
        return {
            organizationId: request.scope.organizationId,
            workspaceId: request.scope.workspaceId,
            idempotencyKey: request.key,
        };
    }
    async claim(lease: IdempotencyLease): Promise<IdempotencyReservation> {
        const inserted = await this.database.queryClient.approvalOperation.createMany({
            data: {
                id: randomUUID(),
                ...this.key(lease.request),
                actorUserId: this.actor.requireActor().userId,
                operation: lease.request.operation,
                requestHash: lease.request.fingerprint,
                fingerprintVersion: lease.request.fingerprintVersion,
                leaseId: lease.leaseId,
            },
            skipDuplicates: true,
        });
        if (inserted.count) return { kind: 'acquired' };
        const row = await this.row(lease.request);
        if (!row.completedAt) return { kind: 'in-progress', fingerprint: row.requestHash };
        if (row.result === null)
            return { kind: 'result-unavailable', fingerprint: row.requestHash };
        return {
            kind: 'completed',
            fingerprint: row.requestHash,
            result: row.result as IdempotencyJsonValue,
        };
    }
    async complete(lease: IdempotencyLease, result: IdempotencyJsonValue) {
        const row = await this.database.queryClient.approvalOperation.updateMany({
            where: { ...this.key(lease.request), leaseId: lease.leaseId, completedAt: null },
            data: {
                completedAt: new Date(),
                result: result === null ? Prisma.JsonNull : (result as Prisma.InputJsonValue),
            },
        });
        return row.count === 1;
    }
    row(request: PreparedIdempotencyRequest) {
        return this.database.queryClient.approvalOperation.findUniqueOrThrow({
            where: { organizationId_workspaceId_idempotencyKey: this.key(request) },
        });
    }
}
