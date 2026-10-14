import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

export type DatabaseTransactionFailure = {
    reason:
        | 'required'
        | 'context-closed'
        | 'context-unbound'
        | 'options-conflict'
        | 'invalid-options'
        | 'rollback-only';
    transactionId?: string;
    option?: string;
};

const catalog = defineInternalErrorCatalog('database-transaction', [
    'required',
    'context-closed',
    'context-unbound',
    'options-conflict',
    'invalid-options',
    'rollback-only',
]);

export const DatabaseTransactionError = defineErrorClass<
    typeof catalog,
    DatabaseTransactionFailure
>(catalog, {
    name: 'DatabaseTransactionError',
    diagnosticMessage: (failure) =>
        ({
            required: 'An active database transaction is required',
            'context-closed': 'Database transaction context is already closed or expired',
            'context-unbound': 'Database transaction context has no bound query client',
            'options-conflict': 'Joined transaction options conflict with the active transaction',
            'invalid-options': 'Database transaction options are invalid',
            'rollback-only': 'Database transaction cannot commit because a joined operation failed',
        })[failure.reason],
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type DatabaseTransactionError = InstanceType<typeof DatabaseTransactionError>;
