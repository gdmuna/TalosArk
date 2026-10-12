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
>(catalog, { name: 'DatabaseTransactionError' });
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type DatabaseTransactionError = InstanceType<typeof DatabaseTransactionError>;
