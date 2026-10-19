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
import { InventoryError } from '../../application/inventory.error.js';
@Injectable()
export class InventoryIdempotencyRepository implements IdempotencyRepository {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly actor: AlsContextAdapter
    ) {}
    private key(request: PreparedIdempotencyRequest) {
        return {
            organizationId: request.scope.organizationId,
            scopeKind: request.scope.kind,
            scopeId:
                request.scope.kind === 'workspace'
                    ? request.scope.workspaceId
                    : request.scope.userId,
            idempotencyKey: request.key,
        };
    }
    async claim(lease: IdempotencyLease): Promise<IdempotencyReservation> {
        const actorUserId = this.actor.requireActor().userId;
        if (
            lease.request.scope.kind === 'organization-user' &&
            lease.request.scope.userId !== actorUserId
        )
            throw new InventoryError({ reason: 'forbidden' });
        const key = this.key(lease.request);
        const inserted = await this.database.queryClient.inventoryOperation.createMany({
            data: {
                id: randomUUID(),
                ...key,
                actorUserId,
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
        const updated = await this.database.queryClient.inventoryOperation.updateMany({
            where: { ...this.key(lease.request), leaseId: lease.leaseId, completedAt: null },
            data: {
                completedAt: new Date(),
                result: result === null ? Prisma.JsonNull : (result as Prisma.InputJsonValue),
            },
        });
        return updated.count === 1;
    }
    async row(request: PreparedIdempotencyRequest) {
        return this.database.queryClient.inventoryOperation.findUniqueOrThrow({
            where: { organizationId_scopeKind_scopeId_idempotencyKey: this.key(request) },
        });
    }
}
