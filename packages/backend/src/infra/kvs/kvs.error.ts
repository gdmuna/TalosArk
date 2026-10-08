import {
    ErrorReply,
    ClientClosedError,
    ClientOfflineError,
    ConnectionTimeoutError,
    SocketClosedUnexpectedlyError,
} from 'redis';

export type KvsFailure = { reason: 'unavailable' | 'command-failed' };

export class KvsError extends Error {
    constructor(
        readonly failure: KvsFailure,
        options?: ErrorOptions
    ) {
        super(`KVS operation failed: ${failure.reason}`, options);
        this.name = 'KvsError';
    }
}

export function normalizeKvsError(error: unknown): KvsError | undefined {
    if (error instanceof KvsError) return error;
    if (
        error instanceof ClientClosedError ||
        error instanceof ClientOfflineError ||
        error instanceof ConnectionTimeoutError ||
        error instanceof SocketClosedUnexpectedlyError ||
        (error instanceof Error &&
            'code' in error &&
            ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN'].includes(
                String(error.code)
            ))
    ) {
        return new KvsError({ reason: 'unavailable' }, { cause: error });
    }
    if (error instanceof ErrorReply)
        return new KvsError({ reason: 'command-failed' }, { cause: error });
    return undefined;
}
