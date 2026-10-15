import { fileURLToPath } from 'node:url';
import type { Worker } from 'node:worker_threads';
import pino from 'pino';
import { defineErrorClass, defineInternalErrorCatalog } from '../../error/error.factory.js';
import type { PrettyModuleReference } from './logger.contribution.js';

const catalog = defineInternalErrorCatalog('logger', [
    'worker-failed',
    'worker-closed',
    'startup-timeout',
]);
const LoggerError = defineErrorClass(catalog, {
    name: 'LoggerError',
    diagnosticMessage: ({ reason }) =>
        ({
            'worker-failed': 'Pretty log worker initialization failed',
            'worker-closed': 'Pretty log worker closed before initialization completed',
            'startup-timeout': 'Pretty log worker initialization deadline exceeded',
        })[reason],
});

export async function createReadyPrettyTransport(
    adapters: readonly PrettyModuleReference[],
    timeoutMs = 5000
): Promise<ReturnType<typeof pino.transport>> {
    const transport = pino.transport({
        target: fileURLToPath(new URL('./pretty.transport.js', import.meta.url)),
        options: { colorize: true, adapters },
    });
    try {
        await new Promise<void>((resolve, reject) => {
            const clean = () => {
                clearTimeout(timer);
                transport.off('ready', ready);
                transport.off('error', failed);
                transport.off('close', closed);
            };
            const ready = () => {
                clean();
                resolve();
            };
            const failed = (cause: Error) => {
                clean();
                reject(new LoggerError({ reason: 'worker-failed' }, { cause }));
            };
            const closed = () => {
                clean();
                reject(new LoggerError({ reason: 'worker-closed' }));
            };
            const timer = setTimeout(() => {
                clean();
                reject(new LoggerError({ reason: 'startup-timeout' }));
            }, timeoutMs);
            transport.once('ready', ready);
            transport.once('error', failed);
            transport.once('close', closed);
        });
        return transport;
    } catch (error) {
        const ignore = () => {};
        transport.on('error', ignore);
        const stream = transport as typeof transport & { worker: Worker; readonly closed: boolean };
        const closed = stream.closed
            ? Promise.resolve()
            : new Promise<void>((resolve) => stream.once('close', resolve));
        try {
            // thread-stream.end() may block before ready; its native worker has no typed destroy API.
            await stream.worker.terminate();
            // Termination can schedule error/close after the native worker's exit event.
            await closed;
        } finally {
            transport.off('error', ignore);
        }
        throw error;
    }
}
