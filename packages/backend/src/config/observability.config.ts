import { registerAs, ConfigType } from '@nestjs/config';
import { z } from 'zod';

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

const ObservabilityConfigValidateSchema = z
    .object({
        API_DOCS_BASE_URL: z.url().default('https://api.example.com/errors'),
        ERROR_REFERENCE_URL: z.url().default('http://localhost:5173/04-appendix/error-reference'),
        LOG_LEVEL: z.preprocess(
            (v) => (v ? v : 'info'),
            z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
        ),
        SLOW_REQUEST_WARN_MS: z.coerce.number().default(1000),
        SLOW_REQUEST_ERROR_MS: z.coerce.number().default(3000),
        SLOW_QUERY_WARN_MS: z.coerce.number().default(100),
        SLOW_QUERY_ERROR_MS: z.coerce.number().default(500),
    })
    .transform((env) => ({
        apiDocsBaseUrl: env.API_DOCS_BASE_URL,
        errorReferenceUrl: env.ERROR_REFERENCE_URL,
        logLevel: env.LOG_LEVEL,
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
    ObservabilityConfigValidateSchema.parse(process.env)
);

export type ObservabilityConfig = ConfigType<typeof observabilityConfig>;
