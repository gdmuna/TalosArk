import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

export type StorageOperation =
    | 'presign'
    | 'upload'
    | 'download'
    | 'delete'
    | 'copy'
    | 'multipart-init'
    | 'multipart-list'
    | 'multipart-complete'
    | 'multipart-abort';
export type StorageFailure = {
    reason:
        | 'not-found'
        | 'unavailable'
        | 'permission-denied'
        | 'configuration'
        | 'invalid-multipart'
        | 'invalid-response'
        | 'partial-delete'
        | 'request-failed';
    operation: StorageOperation;
};
const catalog = defineInternalErrorCatalog('storage', [
    'not-found',
    'unavailable',
    'permission-denied',
    'configuration',
    'invalid-multipart',
    'invalid-response',
    'partial-delete',
    'request-failed',
]);
export const StorageError = defineErrorClass<typeof catalog, StorageFailure>(catalog, {
    name: 'StorageError',
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type StorageError = InstanceType<typeof StorageError>;
