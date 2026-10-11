import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';
import type { ObjectLocation } from './storage.contract.js';

export type StorageOperation =
    | 'presign'
    | 'upload'
    | 'download'
    | 'stat'
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
        | 'checksum-mismatch'
        | 'invalid-request'
        | 'invalid-multipart'
        | 'invalid-response'
        | 'partial-delete'
        | 'request-failed';
    operation: StorageOperation;
    failedObjects?: ReadonlyArray<{
        bucket: ObjectLocation['bucket'];
        key?: ObjectLocation['key'];
        code?: string;
    }>;
};
const catalog = defineInternalErrorCatalog('storage', [
    'not-found',
    'unavailable',
    'permission-denied',
    'configuration',
    'checksum-mismatch',
    'invalid-request',
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
