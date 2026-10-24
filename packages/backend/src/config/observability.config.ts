import { registerAs, ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { parseEnvironment } from './internal/config.validation.js';
import { readTelemetryConfig } from './telemetry.config.js';

// observability

export const API_DOCS_BASE_URL = process.env.API_DOCS_BASE_URL || 'https://api.example.com/errors';

export const LOG_LEVEL =
    process.env.LOG_LEVEL ||
    ('info' as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent' | undefined);

export const SLOW_REQUEST_THRESHOLD = {
    get warn() {
        return Number(process.env.SLOW_REQUEST_WARN_MS || 1000);
    },
    get error() {
        return Number(process.env.SLOW_REQUEST_ERROR_MS || 3000);
    },
} as const;

export const SLOW_QUERY_THRESHOLD = {
    get warn() {
        return Number(process.env.SLOW_QUERY_WARN_MS || 100);
    },
    get error() {
        return Number(process.env.SLOW_QUERY_ERROR_MS || 500);
    },
} as const;

/**
 * VitePress 错误码参考文档页面 URL。
 * `type` 字段将在此 URL 后拼接错误码锚点（如 `#db-record-not-found`）。
 * 生产环境设置为实际文档站点地址，开发环境默认指向本地 VitePress。
 */
export const ERROR_REFERENCE_URL =
    process.env.ERROR_REFERENCE_URL || 'http://localhost:5173/04-appendix/error-reference';

const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);
const emptyAsUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalLevel = z.preprocess(emptyAsUndefined, logLevelSchema.optional());

export const observabilityConfigSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        API_DOCS_BASE_URL: z.url().default('https://api.example.com/errors'),
        ERROR_REFERENCE_URL: z.url().default('http://localhost:5173/04-appendix/error-reference'),
        LOG_LEVEL: z.preprocess(emptyAsUndefined, logLevelSchema.default('info')),
        LOG_OUTPUT: z.preprocess(emptyAsUndefined, z.enum(['console', 'file', 'both']).optional()),
        LOG_CONSOLE_FORMAT: z.preprocess(emptyAsUndefined, z.enum(['pretty', 'json']).optional()),
        LOG_CONSOLE_COLOR: z.enum(['auto', 'always', 'never']).default('auto'),
        LOG_CONSOLE_LEVEL: optionalLevel,
        LOG_FILE_LEVEL: optionalLevel,
        LOG_FILE_PATH: z.string().trim().min(1).default('./data/logs/app.log'),
        LOG_FILE_ROTATION: z.enum(['none', 'hourly', 'daily']).default('none'),
        LOG_FILE_MAX_SIZE_MB: z.coerce.number().int().min(0).max(1024).default(0),
        LOG_FILE_RETAIN_COUNT: z.coerce.number().int().min(1).max(10000).default(14),
        LOG_SAMPLE_RATE: z.preprocess(emptyAsUndefined, z.coerce.number().min(0).max(1).default(1)),
        LOG_WORKER_START_TIMEOUT_MS: z.coerce.number().int().min(1).max(60000).default(5000),
        SLOW_REQUEST_WARN_MS: z.coerce.number().default(1000),
        SLOW_REQUEST_ERROR_MS: z.coerce.number().default(3000),
        SLOW_QUERY_WARN_MS: z.coerce.number().default(100),
        SLOW_QUERY_ERROR_MS: z.coerce.number().default(500),
    })
    .transform((env) => ({
        telemetry: readTelemetryConfig(),
        apiDocsBaseUrl: env.API_DOCS_BASE_URL,
        errorReferenceUrl: env.ERROR_REFERENCE_URL,
        logLevel: env.LOG_LEVEL,
        logging: {
            output: env.LOG_OUTPUT ?? (env.NODE_ENV === 'development' ? 'console' : 'file'),
            console: {
                format:
                    env.LOG_CONSOLE_FORMAT ?? (env.NODE_ENV === 'development' ? 'pretty' : 'json'),
                color: env.LOG_CONSOLE_COLOR,
                level: env.LOG_CONSOLE_LEVEL ?? env.LOG_LEVEL,
            },
            file: {
                path: env.LOG_FILE_PATH,
                level: env.LOG_FILE_LEVEL ?? env.LOG_LEVEL,
                rotation: env.LOG_FILE_ROTATION,
                maxSizeMb: env.LOG_FILE_MAX_SIZE_MB,
                retainCount: env.LOG_FILE_RETAIN_COUNT,
            },
            sampleRate: env.LOG_SAMPLE_RATE,
            workerStartTimeoutMs: env.LOG_WORKER_START_TIMEOUT_MS,
        },
        slowRequestThreshold: {
            warn: env.SLOW_REQUEST_WARN_MS,
            error: env.SLOW_REQUEST_ERROR_MS,
        },
        slowQueryThreshold: {
            warn: env.SLOW_QUERY_WARN_MS,
            error: env.SLOW_QUERY_ERROR_MS,
        },
    }));

export const observabilityConfig = registerAs('observability', () =>
    parseEnvironment(observabilityConfigSchema, 'observability', {
        fields: {
            LOG_SAMPLE_RATE: { scalar: true },
            LOG_FILE_MAX_SIZE_MB: { scalar: true },
            LOG_FILE_RETAIN_COUNT: { scalar: true },
        },
    })
);

export type ObservabilityConfig = ConfigType<typeof observabilityConfig>;
