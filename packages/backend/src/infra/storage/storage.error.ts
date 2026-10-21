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
        | 'bucket-not-found'
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
    'bucket-not-found',
    'checksum-mismatch',
    'invalid-request',
    'invalid-multipart',
    'invalid-response',
    'partial-delete',
    'request-failed',
]);
export const StorageError = defineErrorClass<typeof catalog, StorageFailure>(catalog, {
    name: 'StorageError',
    diagnosticMessage: (failure) =>
        ({
            'not-found': 'Storage object was not found',
            unavailable: 'Object storage is unavailable',
            'permission-denied': 'Object storage denied the operation',
            configuration: 'Object storage connection or authentication configuration is invalid',
            'bucket-not-found':
                'The configured object storage bucket does not exist; check bucket provisioning and the saved upload session bucket',
            'checksum-mismatch': 'Storage object checksum does not match',
            'invalid-request': 'Object storage request is invalid',
            'invalid-multipart': 'Multipart upload or its completion parts are invalid',
            'invalid-response': 'Object storage returned an invalid response',
            'partial-delete': 'Object storage failed to delete some requested objects',
            'request-failed': 'Object storage request failed',
        })[failure.reason],
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type StorageError = InstanceType<typeof StorageError>;
