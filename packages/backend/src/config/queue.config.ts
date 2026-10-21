import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { parseEnvironment } from './internal/config.validation.js';

const schema = z
    .object({
        TASK_ENABLED: z.enum(['true', 'false']).default('false'),
        TASK_WORKER_ENABLED: z.enum(['true', 'false']).default('true'),
        TASK_REDIS_URL: z
            .string()
            .optional()
            .transform((value) => value?.trim() || undefined)
            .pipe(z.url().optional()),
        TASK_QUEUE_PREFIX: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{1,80}$/)
            .default('talosark'),
        TASK_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
        TASK_POLL_INTERVAL_MS: z.coerce.number().int().min(500).max(60_000).default(5000),
        TASK_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(20),
        TASK_REDIS_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(3000),
        TASK_CLOSE_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(3000),
        TASK_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    })
    .transform((env) => ({
        enabled: env.TASK_ENABLED === 'true',
        workerEnabled: env.TASK_WORKER_ENABLED === 'true',
        redisUrl: env.TASK_REDIS_URL,
        prefix: env.TASK_QUEUE_PREFIX,
        concurrency: env.TASK_CONCURRENCY,
        pollIntervalMs: env.TASK_POLL_INTERVAL_MS,
        batchSize: env.TASK_BATCH_SIZE,
        redisTimeoutMs: env.TASK_REDIS_TIMEOUT_MS,
        closeTimeoutMs: env.TASK_CLOSE_TIMEOUT_MS,
        retentionDays: env.TASK_RETENTION_DAYS,
    }));
export const queueConfig = registerAs('queue', () => parseEnvironment(schema, 'queue'));
export type QueueConfig = ConfigType<typeof queueConfig>;
