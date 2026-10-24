import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { Worker } from 'node:worker_threads';
import pino from 'pino';
import type { ObservabilityConfig } from '@/config/observability.config.js';
import { defineErrorClass, defineInternalErrorCatalog } from '../../error/error.factory.js';
import type { PrettyModuleReference } from './logger.contribution.js';
import { observeLogInitialization, observeLogTransport } from './logger.telemetry.js';

type LogTransport = ReturnType<typeof pino.transport> & { readonly closed: boolean };

const catalog = defineInternalErrorCatalog('logger', [
    'worker-failed',
    'worker-closed',
    'startup-timeout',
]);
const LoggerError = defineErrorClass(catalog, {
    name: 'LoggerError',
    diagnosticMessage: ({ reason }) =>
        ({
            'worker-failed': 'Log output worker initialization failed',
            'worker-closed': 'Log output worker closed before initialization completed',
            'startup-timeout': 'Log output worker initialization deadline exceeded',
        })[reason],
});

export async function createReadyLogTransport(
    settings: ObservabilityConfig['logging'],
    adapters: readonly PrettyModuleReference[]
): Promise<ReturnType<typeof pino.transport>> {
    return observeLogInitialization(async () => {
        const transport = pino.transport({
            target: fileURLToPath(new URL('./output.transport.js', import.meta.url)),
            options: {
                settings: {
                    ...settings,
                    file: { ...settings.file, path: resolve(settings.file.path) },
                },
                colorize:
                    settings.console.color === 'always' ||
                    (settings.console.color === 'auto' && !!process.stdout.isTTY),
                adapters,
            },
        });
        observeLogTransport(transport);
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
                }, settings.workerStartTimeoutMs);
                transport.once('ready', ready);
                transport.once('error', failed);
                transport.once('close', closed);
            });
            return transport;
        } catch (error) {
            const ignore = () => {};
            transport.on('error', ignore);
            const stream = transport as LogTransport & { worker: Worker };
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
    });
}
