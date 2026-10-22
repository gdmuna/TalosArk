import { z } from 'zod';
import packageInfo from '@root/package.json' with { type: 'json' };
import { parseEnvironment } from './internal/config.validation.js';

const empty = (value: unknown) => (value === '' ? undefined : value);
const endpoint = z.preprocess(
    empty,
    z
        .url()
        .refine((value) => {
            if (!URL.canParse(value)) return false;
            const url = new URL(value);
            return (
                ['http:', 'https:'].includes(url.protocol) &&
                !url.username &&
                !url.password &&
                !url.search &&
                !url.hash
            );
        }, 'Expected an HTTP(S) collector base URL without credentials, query or fragment')
        .optional()
);

function headers(value: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!value) return result;
    for (const entry of value.split(',')) {
        const separator = entry.indexOf('=');
        const key = entry.slice(0, separator).trim().toLowerCase();
        const content = decodeURIComponent(entry.slice(separator + 1).trim());
        // eslint-disable-next-line no-control-regex -- Reject HTTP header control characters before exporter creation.
        if (separator < 1 || !/^[a-z0-9-]+$/.test(key) || /[\u0000-\u001f\u007f]/.test(content))
            throw new Error('Invalid OTLP header');
        result[key] = content;
    }
    return result;
}

const schema = z
    .object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        APP_NAME: z.preprocess(empty, z.string().default(packageInfo.name)),
        APP_VERSION: z.preprocess(empty, z.string().default(packageInfo.version)),
        OTEL_SDK_DISABLED: z.stringbool().default(true),
        OTEL_SERVICE_NAME: z.preprocess(empty, z.string().max(100).optional()),
        OTEL_TRACES_EXPORTER: z.enum(['otlp', 'none']).default('otlp'),
        OTEL_METRICS_EXPORTER: z.enum(['otlp', 'none']).default('otlp'),
        OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
        OTEL_EXPORTER_OTLP_HEADERS: z
            .string()
            .max(4096)
            .default('')
            .refine((value) => {
                try {
                    headers(value);
                    return true;
                } catch {
                    return false;
                }
            }, 'Expected comma-separated name=percent-encoded-value headers'),
        OTEL_EXPORTER_OTLP_TIMEOUT: z.coerce.number().int().min(100).max(30000).default(3000),
        OTEL_METRIC_EXPORT_INTERVAL: z.coerce.number().int().min(1000).max(120000).default(15000),
        OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(0.1),
        OTEL_BSP_MAX_QUEUE_SIZE: z.coerce.number().int().min(16).max(16384).default(2048),
        OTEL_BSP_MAX_EXPORT_BATCH_SIZE: z.coerce.number().int().min(1).max(4096).default(256),
    })
    .superRefine((env, ctx) => {
        if (
            !env.OTEL_SDK_DISABLED &&
            (env.OTEL_TRACES_EXPORTER !== 'none' || env.OTEL_METRICS_EXPORTER !== 'none') &&
            !env.OTEL_EXPORTER_OTLP_ENDPOINT
        )
            ctx.addIssue({
                code: 'custom',
                path: ['OTEL_EXPORTER_OTLP_ENDPOINT'],
                message: 'An enabled exporter requires a collector endpoint',
            });
        if (env.OTEL_METRIC_EXPORT_INTERVAL <= env.OTEL_EXPORTER_OTLP_TIMEOUT)
            ctx.addIssue({
                code: 'custom',
                path: ['OTEL_METRIC_EXPORT_INTERVAL'],
                message: 'Metric interval must exceed export timeout',
            });
        if (env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE > env.OTEL_BSP_MAX_QUEUE_SIZE)
            ctx.addIssue({
                code: 'custom',
                path: ['OTEL_BSP_MAX_EXPORT_BATCH_SIZE'],
                message: 'Batch size must not exceed queue size',
            });
    })
    .transform((env) => ({
        disabled: env.OTEL_SDK_DISABLED,
        serviceName: env.OTEL_SERVICE_NAME ?? env.APP_NAME,
        serviceVersion: env.APP_VERSION,
        environment: env.NODE_ENV,
        traces: env.OTEL_TRACES_EXPORTER === 'otlp',
        metrics: env.OTEL_METRICS_EXPORTER === 'otlp',
        endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '',
        headers: headers(env.OTEL_EXPORTER_OTLP_HEADERS),
        timeoutMs: env.OTEL_EXPORTER_OTLP_TIMEOUT,
        intervalMs: env.OTEL_METRIC_EXPORT_INTERVAL,
        sampleRate: env.OTEL_TRACES_SAMPLER_ARG,
        queueSize: env.OTEL_BSP_MAX_QUEUE_SIZE,
        batchSize: env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE,
    }));

/** Shared by the pre-import process entry and the Nest configuration snapshot. */
export const readTelemetryConfig = () =>
    parseEnvironment(schema, 'telemetry', {
        fields: {
            OTEL_EXPORTER_OTLP_ENDPOINT: {
                customExpected: 'HTTP(S) collector base URL without credentials, query or fragment',
            },
            OTEL_EXPORTER_OTLP_HEADERS: {
                customExpected: 'comma-separated name=percent-encoded-value headers',
            },
            OTEL_EXPORTER_OTLP_TIMEOUT: { scalar: true },
            OTEL_METRIC_EXPORT_INTERVAL: { scalar: true },
            OTEL_TRACES_SAMPLER_ARG: { scalar: true },
            OTEL_BSP_MAX_QUEUE_SIZE: { scalar: true },
            OTEL_BSP_MAX_EXPORT_BATCH_SIZE: { scalar: true },
        },
        refinements: {
            'An enabled exporter requires a collector endpoint':
                'OTEL_EXPORTER_OTLP_ENDPOINT is required when telemetry export is enabled',
            'Metric interval must exceed export timeout':
                'OTEL_METRIC_EXPORT_INTERVAL > OTEL_EXPORTER_OTLP_TIMEOUT',
            'Batch size must not exceed queue size':
                'OTEL_BSP_MAX_EXPORT_BATCH_SIZE <= OTEL_BSP_MAX_QUEUE_SIZE',
        },
    });
export type TelemetryConfig = z.output<typeof schema>;
