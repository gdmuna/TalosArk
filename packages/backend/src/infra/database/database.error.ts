import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

interface DatabaseFailureContext {
    model?: string;
    table?: string;
    schema?: string;
    sqlState?: string;
}

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
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type DatabaseError = InstanceType<typeof DatabaseError>;
