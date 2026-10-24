import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { parseEnvironment } from './internal/config.validation.js';

const LifecycleConfigSchema = z
    .object({
        OTEL_SDK_DISABLED: z.stringbool().default(true),
        SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
        HTTP_DRAIN_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
        LOG_FLUSH_TIMEOUT_MS: z.coerce.number().int().positive().default(500),
        TELEMETRY_FLUSH_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(1000),
    })
    .refine(
        (env) =>
            env.HTTP_DRAIN_TIMEOUT_MS +
                env.LOG_FLUSH_TIMEOUT_MS +
                (env.OTEL_SDK_DISABLED ? 0 : env.TELEMETRY_FLUSH_TIMEOUT_MS) <
            env.SHUTDOWN_TIMEOUT_MS,
        {
            path: ['HTTP_DRAIN_TIMEOUT_MS'],
            message: 'HTTP drain and log flush must leave time for resource cleanup',
        }
    )
    .transform((env) => ({
        shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
        httpDrainTimeoutMs: env.HTTP_DRAIN_TIMEOUT_MS,
        logFlushTimeoutMs: env.LOG_FLUSH_TIMEOUT_MS,
        telemetryFlushTimeoutMs: env.OTEL_SDK_DISABLED ? 0 : env.TELEMETRY_FLUSH_TIMEOUT_MS,
    }));

export const lifecycleConfig = registerAs('lifecycle', () =>
    parseEnvironment(LifecycleConfigSchema, 'lifecycle', {
        refinements: {
            'HTTP drain and log flush must leave time for resource cleanup':
                'HTTP_DRAIN_TIMEOUT_MS + LOG_FLUSH_TIMEOUT_MS + TELEMETRY_FLUSH_TIMEOUT_MS < SHUTDOWN_TIMEOUT_MS',
        },
    })
);
export type LifecycleConfig = ConfigType<typeof lifecycleConfig>;
