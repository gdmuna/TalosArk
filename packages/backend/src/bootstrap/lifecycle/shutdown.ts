import type { Server } from 'node:http';
import type { NestApplicationContext } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PinoLogger } from 'nestjs-pino';
import type { LifecycleConfig } from '@/config/lifecycle.config.js';
import { HealthState } from '@/system/health/health.state.js';

/** The process owns signals and the deadline; Nest still owns resource hooks. */
export async function installProcessShutdown(app: NestFastifyApplication, config: LifecycleConfig) {
    const health = app.get(HealthState);
    const logger = (await app.resolve(PinoLogger)).logger;
    let closing: Promise<void> | undefined;

    function close(signal?: NodeJS.Signals): Promise<void> {
        if (closing) return closing;
        health.beginShutdown();
        closing = shutdown(signal);
        return closing;
    }

    async function shutdown(signal?: NodeJS.Signals): Promise<void> {
        const watchdog = setTimeout(() => {
            process.stderr.write('Application shutdown exceeded its hard deadline\n');
            process.exit(1);
        }, config.shutdownTimeoutMs);
        let timer: NodeJS.Timeout | undefined;
        const deadline = new Promise<never>((_, reject) => {
            timer = setTimeout(
                () => reject(new Error('Application cleanup exceeded its shutdown budget')),
                config.shutdownTimeoutMs - config.logFlushTimeoutMs
            );
        });
        let failure: unknown;
        let failed = false;
        logger.info({ signal }, 'Application shutdown started');
        try {
            await Promise.race([drainAndClose(signal), deadline]);
            logger.info('Application resources closed');
        } catch (error) {
            failed = true;
            failure = error;
            logger.error({ err: error }, 'Application shutdown failed');
        } finally {
            clearTimeout(timer);
            try {
                await flushLogs();
            } catch (error) {
                if (!failed) failure = error;
                failed = true;
                process.stderr.write('Application log flush failed or timed out\n');
            }
            clearTimeout(watchdog);
            process.off('SIGTERM', onSigterm);
            process.off('SIGINT', onSigint);
        }
        if (failed) throw failure;
    }

    async function drainAndClose(signal?: NodeJS.Signals): Promise<void> {
        // Nest close() destroys providers before disposing HTTP: drain HTTP first.
        const timer = setTimeout(() => {
            logger.warn('HTTP drain timed out; remaining connections aborted');
            (app.getHttpServer() as Server).closeAllConnections();
        }, config.httpDrainTimeoutMs);
        try {
            await app.getHttpAdapter().close();
        } finally {
            clearTimeout(timer);
        }
        await (app.close as NestApplicationContext['close']).call(app, signal);
    }

    async function flushLogs(): Promise<void> {
        app.flushLogs();
        // nestjs-pino may create separate request and out-of-context roots.
        const roots = new Set([logger, PinoLogger.root].filter(Boolean));
        let timer: NodeJS.Timeout | undefined;
        try {
            await Promise.race([
                Promise.all(
                    [...roots].map(
                        (root) =>
                            new Promise<void>((resolve, reject) =>
                                root.flush((error) => (error ? reject(error) : resolve()))
                            )
                    )
                ),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(
                        () => reject(new Error('Log flush timed out')),
                        config.logFlushTimeoutMs
                    );
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    const onSigterm = () =>
        void close('SIGTERM').then(
            () => process.exit(0),
            () => process.exit(1)
        );
    const onSigint = () =>
        void close('SIGINT').then(
            () => process.exit(0),
            () => process.exit(1)
        );
    process.on('SIGTERM', onSigterm);
    // HAS_PROBLEM
    process.on('SIGINT', onSigint);
    return close;
}
