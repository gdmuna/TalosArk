import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';

const LifecycleConfigSchema = z
    .object({
        SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
        HTTP_DRAIN_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
        LOG_FLUSH_TIMEOUT_MS: z.coerce.number().int().positive().default(500),
    })
    .refine(
        (env) => env.HTTP_DRAIN_TIMEOUT_MS + env.LOG_FLUSH_TIMEOUT_MS < env.SHUTDOWN_TIMEOUT_MS,
        'HTTP drain and log flush must leave time for resource cleanup'
    )
    .transform((env) => ({
        shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
        httpDrainTimeoutMs: env.HTTP_DRAIN_TIMEOUT_MS,
        logFlushTimeoutMs: env.LOG_FLUSH_TIMEOUT_MS,
    }));

export const lifecycleConfig = registerAs('lifecycle', () =>
    LifecycleConfigSchema.parse(process.env)
);
export type LifecycleConfig = ConfigType<typeof lifecycleConfig>;
