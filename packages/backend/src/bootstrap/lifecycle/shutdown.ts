import type { Server } from 'node:http';
import type { INestApplicationContext } from '@nestjs/common';
import type { NestApplicationContext } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PinoLogger } from 'nestjs-pino';
import type { LifecycleConfig } from '@/config/lifecycle.config.js';
import { HealthState } from '@/system/health/health.state.js';
import { BullmqRuntime } from '@/infra/queue/bullmq/index.js';
import type { ObservabilityRuntime } from '@/platform/observability/observability.runtime.js';
import { observeLifecycle } from '@/platform/observability/metrics/lifecycle.metric.js';

/** The process owns signals and the deadline; Nest still owns resource hooks. */
export async function installProcessShutdown(
    app: INestApplicationContext,
    config: LifecycleConfig,
    observability?: ObservabilityRuntime
) {
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
                config.shutdownTimeoutMs - config.logFlushTimeoutMs - config.telemetryFlushTimeoutMs
            );
        });
        let failure: unknown;
        let failed = false;
        logger.info({ signal }, 'Application shutdown started');
        try {
            await observeLifecycle('shutdown', () =>
                Promise.race([drainAndClose(signal), deadline])
            );
            logger.info('Application resources closed');
        } catch (error) {
            failed = true;
            failure = error;
            logger.error({ err: error }, 'Application shutdown failed');
        } finally {
            clearTimeout(timer);
            try {
                await observability?.shutdown(config.telemetryFlushTimeoutMs);
            } catch {
                logger.warn(
                    'Telemetry shutdown failed or timed out; application cleanup continues'
                );
            }
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
        if (!('getHttpAdapter' in app)) {
            await app.get(BullmqRuntime).stop();
            await app.close();
            return;
        }
        const httpApp = app as NestFastifyApplication;
        // Nest close() destroys providers before disposing HTTP: drain HTTP first.
        const timer = setTimeout(() => {
            logger.warn('HTTP drain timed out; remaining connections aborted');
            (httpApp.getHttpServer() as Server).closeAllConnections();
        }, config.httpDrainTimeoutMs);
        try {
            await observeLifecycle('http-drain', () => httpApp.getHttpAdapter().close());
        } finally {
            clearTimeout(timer);
        }
        await app.get(BullmqRuntime).stop();
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
