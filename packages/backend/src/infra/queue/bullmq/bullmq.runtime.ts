import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { AllConfig, QueueConfig } from '@/config/index.js';
import { TaskHandlerRegistry } from '@/core/task/task-handler.registry.js';
import { TaskRepository } from '@/core/task/internal/task.repository.js';
import { TaskError } from '@/core/task/task.error.js';
import { BullmqTaskPublisher, taskQueueName, type TaskEnvelope } from './bullmq-task-publisher.js';
import { BullmqWorkerAdapter } from './bullmq-worker.adapter.js';
import { observeTaskBacklog } from './bullmq.observation.js';
import {
    observeQueueOperation,
    recordQueueConnection,
    recordQueueDelivery,
    recordQueueClaimed,
} from './bullmq.telemetry.js';

@Injectable()
export class BullmqRuntime implements OnModuleDestroy {
    private queue?: Queue<TaskEnvelope>;
    private worker?: Worker<TaskEnvelope>;
    private readonly connections: Redis[] = [];
    private timer?: NodeJS.Timeout;
    private ticking?: Promise<void>;
    private closing?: Promise<void>;
    private stopping = false;
    private readonly active = new Set<AbortController>();
    private readonly options: QueueConfig;
    private stopObservation?: () => Promise<void>;

    constructor(
        private readonly config: ConfigService<AllConfig, true>,
        private readonly handlers: TaskHandlerRegistry,
        private readonly repository: TaskRepository,
        private readonly publisher: BullmqTaskPublisher,
        private readonly adapter: BullmqWorkerAdapter,
        @InjectPinoLogger(BullmqRuntime.name) private readonly logger: PinoLogger
    ) {
        this.options = config.get('queue', { infer: true });
    }

    async start(worker = this.options.workerEnabled): Promise<void> {
        if (this.stopping) throw new TaskError({ reason: 'stopping' });
        this.handlers.initialize();
        if (!this.options.enabled || this.queue) return;
        return observeQueueOperation('start', async () => {
            const url = this.options.redisUrl ?? this.config.get('kvs.kvsUrl', { infer: true });
            if (!url) throw new TaskError({ reason: 'invalid-state' });
            const connect = (blocking: boolean) => {
                const parsed = new URL(url);
                if (parsed.protocol === 'valkey:') parsed.protocol = 'redis:';
                if (parsed.protocol === 'valkeys:') parsed.protocol = 'rediss:';
                const client = new Redis(parsed.href, {
                    lazyConnect: true,
                    maxRetriesPerRequest: blocking ? null : 1,
                    enableOfflineQueue: blocking,
                    connectTimeout: this.options.redisTimeoutMs,
                    ...(blocking ? {} : { commandTimeout: this.options.redisTimeoutMs }),
                });
                client.on('error', () => {
                    recordQueueConnection(blocking ? 'blocking' : 'command', 'error');
                    this.logger.error(
                        { event: 'task.connection.failed' },
                        'Task queue connection failed'
                    );
                });
                const type = blocking ? 'blocking' : 'command';
                recordQueueConnection(type, 'created');
                client.on('ready', () => recordQueueConnection(type, 'ready'));
                client.on('reconnecting', () => recordQueueConnection(type, 'reconnecting'));
                client.on('end', () => recordQueueConnection(type, 'closed'));
                this.connections.push(client);
                return client;
            };
            const connection = connect(false);
            this.queue = new Queue<TaskEnvelope>(taskQueueName, {
                prefix: this.options.prefix,
                connection,
            });
            this.queue.on('error', () => {
                recordQueueDelivery('queue-error');
                this.logger.error({ event: 'task.queue.failed' }, 'Task queue operation failed');
            });
            const telemetry = this.config.get('observability.telemetry', { infer: true });
            if (!telemetry.disabled && telemetry.metrics) {
                this.stopObservation = observeTaskBacklog(
                    connection,
                    this.options.prefix,
                    this.repository
                );
            }
            if (worker) {
                this.worker = new Worker<TaskEnvelope>(
                    taskQueueName,
                    async (job, token) => {
                        const controller = new AbortController();
                        this.active.add(controller);
                        if (this.stopping) controller.abort(new TaskError({ reason: 'stopping' }));
                        const start = Date.now();
                        try {
                            await this.adapter.execute(job, controller.signal, token);
                            this.logger.info(
                                {
                                    event: 'task.processed',
                                    jobId: job.data.id,
                                    durationMs: Date.now() - start,
                                },
                                'Background task processing finished'
                            );
                        } finally {
                            this.active.delete(controller);
                        }
                    },
                    {
                        connection: connect(true),
                        prefix: this.options.prefix,
                        autorun: false,
                        concurrency: this.options.concurrency,
                        maxStalledCount: 1,
                    }
                );
                this.worker.on('error', () => {
                    recordQueueDelivery('worker-error');
                    this.logger.error({ event: 'task.worker.failed' }, 'Task worker failed');
                });
                this.worker.on('failed', (job) => {
                    recordQueueDelivery('failed');
                    this.logger.warn(
                        { event: 'task.attempt.failed', jobId: job?.data.id },
                        'Background task attempt failed'
                    );
                });
                this.worker.on('stalled', () => recordQueueDelivery('stalled'));
                void this.worker.run().catch(() => {
                    recordQueueDelivery('worker-stopped');
                    this.logger.error(
                        { event: 'task.worker.stopped' },
                        'Task worker stopped unexpectedly'
                    );
                });
            }
            this.logger.info({ event: 'task.started', worker }, 'Background task runtime started');
            this.schedule();
        });
    }

    private schedule(): void {
        if (this.stopping) return;
        this.timer = setTimeout(() => {
            this.ticking = this.tick().catch(() =>
                this.logger.error({ event: 'task.dispatch.failed' }, 'Task dispatch cycle failed')
            );
            void this.ticking.finally(() => {
                this.ticking = undefined;
                this.schedule();
            });
        }, this.options.pollIntervalMs);
        this.timer.unref();
    }

    async tick(): Promise<void> {
        const queue = this.queue;
        if (!queue || this.stopping) return;
        return observeQueueOperation('poll', async () => {
            const rows = await this.repository.claim(this.options.batchSize, 30_000);
            recordQueueClaimed(rows.length);
            for (const row of rows) {
                if (this.stopping) {
                    await this.repository.release(row, 0);
                    continue;
                }
                try {
                    await this.publisher.dispatch(queue, row);
                } catch (error) {
                    await this.repository.release(row, 10_000, true);
                    this.logger.warn(
                        { event: 'task.dispatch.deferred', jobId: row.id, err: error },
                        'Task dispatch deferred after an infrastructure failure'
                    );
                }
            }
        });
    }

    stop(): Promise<void> {
        return (this.closing ??= observeQueueOperation('stop', () => this.close()));
    }
    onModuleDestroy(): Promise<void> {
        return this.stop();
    }

    private async close(): Promise<void> {
        this.stopping = true;
        clearTimeout(this.timer);
        const observation = this.stopObservation?.();
        for (const controller of this.active)
            controller.abort(new TaskError({ reason: 'stopping' }));
        let timer: NodeJS.Timeout | undefined;
        try {
            await Promise.race([
                (async () => {
                    await this.worker?.close();
                    await this.ticking;
                    await observation;
                    await this.queue?.close();
                })(),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(
                        () => reject(new TaskError({ reason: 'close-timeout' })),
                        this.options.closeTimeoutMs
                    );
                }),
            ]);
        } finally {
            clearTimeout(timer);
            for (const client of this.connections) client.disconnect();
        }
    }
}
