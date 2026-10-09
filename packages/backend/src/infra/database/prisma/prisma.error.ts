import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

export type DatabaseFailure =
    | {
          reason: 'unique-constraint';
          model?: string;
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
      };

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
