import { isIP } from 'node:net';
import { ConnectionTimeoutError } from 'redis';
import type { ErrorDiagnosticProjector } from '@/platform/observability/logger/logger.diagnostic.js';
import { kvsConnectionMessage } from './kvs.log.message.js';

export const projectKvsError: ErrorDiagnosticProjector = (error) => {
    if (error instanceof ConnectionTimeoutError) return { message: 'Connection timed out' };
    if (!('code' in error) || typeof error.code !== 'string') return undefined;
    const message = kvsConnectionMessage(error.code);
    if (!message) return undefined;
    const port = 'port' in error ? error.port : undefined;

    // Keep only validated network coordinates, never the URL or its credentials.
    return {
        message: message[0].toUpperCase() + message.slice(1),
        address:
            'address' in error && typeof error.address === 'string' && isIP(error.address)
                ? error.address
                : undefined,
        port:
            typeof port === 'number' && Number.isInteger(port) && port >= 0 && port <= 65535
                ? port
                : undefined,
        syscall:
            'syscall' in error && (error.syscall === 'connect' || error.syscall === 'getaddrinfo')
                ? error.syscall
                : undefined,
    };
};

export default projectKvsError;
