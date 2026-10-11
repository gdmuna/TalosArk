import {
    ErrorReply,
    ClientClosedError,
    ClientOfflineError,
    DisconnectsClientError,
    ConnectionTimeoutError,
    SocketClosedUnexpectedlyError,
} from 'redis';
import { KvsError } from './kvs.error.js';

export function normalizeKvsError(error: unknown): KvsError | undefined {
    if (error instanceof KvsError) return error;
    if (
        error instanceof ClientClosedError ||
        error instanceof ClientOfflineError ||
        error instanceof DisconnectsClientError ||
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
