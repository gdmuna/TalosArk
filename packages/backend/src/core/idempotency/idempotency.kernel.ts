import { monotonicFactory } from 'ulid';
import type { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { IdempotencyError } from './idempotency.error.js';
import type { IdempotencyRepository } from './idempotency.repository.js';
import type {
    IdempotencyExecution,
    IdempotencyLease,
    IdempotencyPrepareInput,
    IdempotencyResultCodec,
    PreparedIdempotencyRequest,
} from './idempotency.types.js';
import { RequestFingerprint } from './request-fingerprint.js';
import { resultSnapshot } from './internal/canonical-json.js';
import {
    parseIdempotencyInput,
    parseReservation,
    prepareSchema,
    requestSchema,
} from './internal/idempotency.rules.js';

export class IdempotencyKernel {
    private readonly nextLeaseId = monotonicFactory();

    constructor(
        private readonly database: DatabaseRuntime,
        private readonly repository: IdempotencyRepository
    ) {}

    prepare(input: IdempotencyPrepareInput): PreparedIdempotencyRequest {
        const value = parseIdempotencyInput(prepareSchema, input);
        return Object.freeze({
            scope: Object.freeze(value.scope),
            operation: value.operation,
            key: value.key,
            fingerprintVersion: value.fingerprintVersion,
            fingerprint: RequestFingerprint.create({
                operation: value.operation,
                version: value.fingerprintVersion,
                payload: value.payload,
            }),
        });
    }

    run<T>(
        input: PreparedIdempotencyRequest,
        work: () => T | PromiseLike<T>,
        codec: IdempotencyResultCodec<T>
    ): Promise<IdempotencyExecution<T>> {
        return this.database.transaction.run(
            async () => {
                const value = parseIdempotencyInput(requestSchema, input);
                const request = Object.freeze({ ...value, scope: Object.freeze(value.scope) });
                const transaction = this.database.transaction.current();
                if (!transaction || transaction.state !== 'active' || transaction.rollbackOnly)
                    throw new IdempotencyError({ reason: 'lease-lost' });
                const lease: IdempotencyLease = Object.freeze({
                    leaseId: this.nextLeaseId(),
                    transactionId: transaction.id,
                    request,
                });
                const reservation = parseReservation(await this.repository.claim(lease));
                this.assertTransaction(lease);
                if (reservation.kind !== 'acquired') {
                    if (reservation.fingerprint !== request.fingerprint)
                        throw new IdempotencyError({ reason: 'fingerprint-conflict' });
                    if (reservation.kind === 'in-progress')
                        throw new IdempotencyError({ reason: 'request-in-progress' });
                    if (reservation.kind === 'result-unavailable')
                        throw new IdempotencyError({ reason: 'result-unavailable' });
                    return Object.freeze({
                        kind: 'replayed',
                        value: codec.decode(resultSnapshot(reservation.result)),
                    });
                }

                const result = await work();
                this.assertTransaction(lease);
                const snapshot = resultSnapshot(codec.encode(result));
                const output = codec.decode(snapshot);
                const completed = await this.repository.complete(lease, snapshot);
                if (completed === false) throw new IdempotencyError({ reason: 'lease-lost' });
                if (completed !== true)
                    throw new IdempotencyError({ reason: 'invalid-repository' });
                this.assertTransaction(lease);
                return Object.freeze({ kind: 'executed', value: output });
            },
            { propagation: 'mandatory' }
        );
    }

    private assertTransaction(lease: IdempotencyLease): void {
        const transaction = this.database.transaction.current();
        if (
            !transaction ||
            transaction.id !== lease.transactionId ||
            transaction.state !== 'active' ||
            transaction.rollbackOnly
        )
            throw new IdempotencyError({ reason: 'lease-lost' });
    }
}
