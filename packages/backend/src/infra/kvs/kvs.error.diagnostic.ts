import { isIP } from 'node:net';
import { ConnectionTimeoutError } from 'redis';
import type { ErrorDiagnosticProjector } from '@/platform/error/error.diagnostic.js';
import { KvsError } from './kvs.error.js';

const connectionMessage: Record<string, string> = {
    ECONNREFUSED: 'Connection refused',
    ECONNRESET: 'Connection reset by peer',
    ETIMEDOUT: 'Connection timed out',
    EPIPE: 'Connection pipe closed',
    ENOTFOUND: 'Host lookup failed',
    EAI_AGAIN: 'Host lookup temporarily unavailable',
};

export const projectKvsError: ErrorDiagnosticProjector = (error) => {
    if (KvsError.is(error)) {
        const message = {
            unavailable: 'KVS is unavailable',
            'command-failed': 'KVS command failed',
            'connect-timeout': 'KVS connection deadline exceeded',
            'close-timeout': 'KVS close deadline exceeded',
        }[error.failure.reason];
        return { message };
    }
    if (error instanceof ConnectionTimeoutError) return { message: 'Connection timed out' };
    if (!('code' in error) || typeof error.code !== 'string') return undefined;
    const message = Object.hasOwn(connectionMessage, error.code)
        ? connectionMessage[error.code]
        : undefined;
    if (!message) return undefined;

    // Keep only validated network coordinates, never the URL or its credentials.
    return {
        message,
        address:
            'address' in error && typeof error.address === 'string' && isIP(error.address)
                ? error.address
                : undefined,
        port: 'port' in error && typeof error.port === 'number' ? error.port : undefined,
        syscall:
            'syscall' in error && (error.syscall === 'connect' || error.syscall === 'getaddrinfo')
                ? error.syscall
                : undefined,
    };
};
