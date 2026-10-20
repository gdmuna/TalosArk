import { DatabaseError } from '@/infra/database/database.error.js';
import { IdempotencyError } from '@/core/idempotency/index.js';
import { composeErrorMappers, defineErrorMapper } from '@/platform/error/index.js';
import { ApprovalError } from './approval.error.js';
export const approvalErrors = composeErrorMappers([
    defineErrorMapper(DatabaseError, ApprovalError, (failure) =>
        failure.reason === 'transaction-conflict' ? { reason: 'conflict' as const } : undefined
    ),
    defineErrorMapper(IdempotencyError, ApprovalError, (failure) => {
        if (['fingerprint-conflict', 'request-in-progress'].includes(failure.reason))
            return { reason: 'conflict' as const };
        if (failure.reason === 'result-unavailable') return { reason: 'result' as const };
        return undefined;
    }),
]);
