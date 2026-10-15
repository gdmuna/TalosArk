import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

interface DatabaseFailureContext {
    model?: string;
    table?: string;
    schema?: string;
    sqlState?: string;
}

// prettier-ignore
export type DatabaseFailure = DatabaseFailureContext &
    (
        | {
            reason: 'unique-constraint';
            fields: readonly string[];
            constraint?: string;
        }
        | {
            reason:
                | 'record-not-found'
                | 'transaction-conflict'
                | 'unavailable'
                | 'configuration'
                | 'query-failed';
        }
    );

const catalog = defineInternalErrorCatalog('database', [
    'unique-constraint',
    'record-not-found',
    'transaction-conflict',
    'unavailable',
    'configuration',
    'query-failed',
]);

export const DatabaseError = defineErrorClass<typeof catalog, DatabaseFailure>(catalog, {
    name: 'DatabaseError',
    diagnosticMessage: (failure) =>
        ({
            'unique-constraint': 'Database write violates a unique constraint',
            'record-not-found': 'Database record was not found',
            'transaction-conflict': 'Database transaction conflicted with another write',
            unavailable: 'Database is unavailable',
            configuration: 'Database connection or authentication configuration is invalid',
            'query-failed': 'Database query failed',
        })[failure.reason],
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type DatabaseError = InstanceType<typeof DatabaseError>;
