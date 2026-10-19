import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

const messages = {
    'invalid-input': 'File input violates the declared constraints',
    configuration: 'File module configuration is invalid',
    unavailable: 'The file or upload session is unavailable',
    busy: 'The file operation is already running or capacity is exhausted',
    expired: 'The upload session has expired',
    'invalid-state': 'The upload session cannot perform this operation',
    conflict: 'The upload retry does not match its original intent',
    'not-ready': 'The uploaded object is not ready for verification',
    'size-mismatch': 'The uploaded object size does not match',
    'checksum-mismatch': 'The uploaded object SHA-256 does not match',
    'invalid-parts': 'The multipart manifest does not match the upload plan',
    'in-use': 'The file asset has active business references',
    'invalid-purpose': 'The file purpose contribution is invalid',
    'purpose-not-ready': 'File purpose contributions have not been initialized',
    'unknown-purpose': 'The file purpose is not registered',
    'format-not-allowed':
        'The filename extension and declared media type are not allowed for this purpose',
    'size-not-allowed': 'The file exceeds the size limit for this purpose',
    'resource-readonly': 'The resource does not allow attachment changes',
    'invalid-cursor': 'The file reference cursor does not match this query',
    'transaction-active': 'File transfer operations must run outside a database transaction',
    timeout: 'The file operation exceeded its deadline',
    stopping: 'The file module is stopping',
    'close-timeout': 'File operations did not stop within the shutdown budget',
} as const;
const catalog = defineInternalErrorCatalog(
    'file',
    Object.keys(messages) as (keyof typeof messages)[]
);

export const FileError = defineErrorClass(catalog, {
    name: 'FileError',
    diagnosticMessage: (failure) => messages[failure.reason],
});
