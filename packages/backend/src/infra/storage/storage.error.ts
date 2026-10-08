import { S3ServiceException } from '@aws-sdk/client-s3';

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

export class StorageError extends Error {
    constructor(
        readonly failure: StorageFailure,
        options?: ErrorOptions
    ) {
        super(`Storage operation failed: ${failure.reason}`, options);
        this.name = 'StorageError';
    }
}

export function normalizeStorageError(
    error: unknown,
    operation: StorageOperation
): StorageError | undefined {
    if (error instanceof StorageError) return error;
    if (error instanceof S3ServiceException) {
        const status = error.$metadata.httpStatusCode;
        const reason = ['NoSuchBucket', 'InvalidAccessKeyId', 'SignatureDoesNotMatch'].includes(
            error.name
        )
            ? 'configuration'
            : error.name === 'NoSuchUpload'
              ? 'invalid-multipart'
              : status === 404
                ? 'not-found'
                : status === 401 || status === 403
                  ? 'permission-denied'
                  : (status !== undefined && status >= 500) || status === 429
                    ? 'unavailable'
                    : 'request-failed';
        return new StorageError({ reason, operation }, { cause: error });
    }
    if (error instanceof Error) {
        if (error.name === 'CredentialsProviderError') {
            return new StorageError({ reason: 'configuration', operation }, { cause: error });
        }
        if (
            error.name === 'TimeoutError' ||
            ('code' in error &&
                [
                    'ECONNREFUSED',
                    'ECONNRESET',
                    'ETIMEDOUT',
                    'EPIPE',
                    'ENOTFOUND',
                    'EAI_AGAIN',
                    'ERR_STREAM_PREMATURE_CLOSE',
                ].includes(String(error.code)))
        ) {
            return new StorageError({ reason: 'unavailable', operation }, { cause: error });
        }
    }
    return undefined;
}
