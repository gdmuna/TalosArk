import { registerAs, ConfigType } from '@nestjs/config';
import { z } from 'zod/v4';
import { parseEnvironment } from './internal/config.validation.js';

// http

export const THROTTLE_TTL_MS = Number(process.env.THROTTLE_TTL_MS || 300000);

export const THROTTLE_LIMIT =
    process.env.THROTTLE_LIMIT === 'Infinity'
        ? Infinity
        : Number(process.env.THROTTLE_LIMIT || 1000);

export const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);

/** 请求 ID header 名称，贯穿完整请求链路 */
export const REQUEST_ID_HEADER = process.env.REQUEST_ID_HEADER?.toLowerCase() || 'x-request-id';

/** CORS 预检缓存时间（秒），对应 Access-Control-Max-Age */
export const CORS_PREFLIGHT_MAX_AGE_SECONDS = Number(
    process.env.CORS_PREFLIGHT_MAX_AGE_SECONDS || 86400
);

/** 允许的 CORS 请求方法 */
export const CORS_ALLOWED_METHODS = process.env.CORS_ALLOWED_METHODS?.split(',')
    .map((m) => m.trim())
    .filter(Boolean) || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

/** 允许的 CORS 请求头 */
export const CORS_ALLOWED_HEADERS = process.env.CORS_ALLOWED_HEADERS?.split(',')
    .map((h) => h.trim())
    .filter(Boolean) || ['Content-Type', 'Authorization', 'X-TalosArk-Client'];

const BrowserOriginSchema = z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
}, 'Expected a canonical HTTP(S) origin without a path');

const BrowserOriginPolicySchema = z
    .discriminatedUnion('mode', [
        z.object({ mode: z.literal('deny') }),
        z.object({
            mode: z.literal('allowlist'),
            origins: z.array(BrowserOriginSchema).min(1).readonly(),
        }),
        z.object({ mode: z.literal('development-loopback') }),
        z.object({ mode: z.literal('development-any') }),
    ])
    .readonly();

export type BrowserOriginPolicy = z.infer<typeof BrowserOriginPolicySchema>;

export const httpConfigValidateSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        CORS_ENABLED: z
            .enum(['true', 'false'])
            .default('true')
            .transform((value) => value === 'true'),
        HTTP_BROWSER_ORIGIN_MODE: z
            .enum(['deny', 'allowlist', 'development-loopback', 'development-any'])
            .default('deny'),
        HTTP_BROWSER_ALLOWED_ORIGINS: z
            .string()
            .default('')
            .transform((value) =>
                value
                    .split(',')
                    .map((origin) => origin.trim())
                    .filter(Boolean)
            )
            .pipe(z.array(BrowserOriginSchema)),
        THROTTLE_TTL_MS: z.coerce.number().int().min(1000).default(300000),
        THROTTLE_LIMIT: z
            .union([z.literal('Infinity'), z.coerce.number().int().min(1)])
            .transform((val) => (val === 'Infinity' ? Infinity : val))
            .default(1000),
        REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
        REQUEST_ID_HEADER: z
            .string()
            .default('x-request-id')
            .transform((h) => h.toLowerCase()),
        CORS_PREFLIGHT_MAX_AGE_SECONDS: z.coerce.number().int().min(0).default(86400),
        CORS_ALLOWED_METHODS: z
            .string()
            .transform((s) => {
                if (s) {
                    return s
                        .split(',')
                        .map((m) => m.trim())
                        .filter(Boolean);
                } else return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
            })
            .default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
        CORS_ALLOWED_HEADERS: z
            .string()
            .transform((s) => {
                if (s) {
                    return s
                        .split(',')
                        .map((h) => h.trim())
                        .filter(Boolean);
                } else return ['Content-Type', 'Authorization', 'X-TalosArk-Client'];
            })
            .default(['Content-Type', 'Authorization', 'X-TalosArk-Client']),
    })
    .superRefine((env, context) => {
        if (
            env.HTTP_BROWSER_ORIGIN_MODE === 'allowlist' &&
            env.HTTP_BROWSER_ALLOWED_ORIGINS.length === 0
        )
            context.addIssue({
                code: 'custom',
                path: ['HTTP_BROWSER_ALLOWED_ORIGINS'],
                message: 'Allowlist mode requires at least one origin',
            });
        if (
            env.NODE_ENV !== 'development' &&
            env.HTTP_BROWSER_ORIGIN_MODE.startsWith('development-')
        )
            context.addIssue({
                code: 'custom',
                path: ['HTTP_BROWSER_ORIGIN_MODE'],
                message: 'Development origin modes require NODE_ENV=development',
            });
        if (
            env.NODE_ENV === 'production' &&
            env.HTTP_BROWSER_ORIGIN_MODE === 'allowlist' &&
            env.HTTP_BROWSER_ALLOWED_ORIGINS.some((origin) => !origin.startsWith('https://'))
        )
            context.addIssue({
                code: 'custom',
                path: ['HTTP_BROWSER_ALLOWED_ORIGINS'],
                message: 'Production browser origins must use HTTPS',
            });
    })
    .transform((env) => ({
        browserOriginPolicy: BrowserOriginPolicySchema.parse(
            env.HTTP_BROWSER_ORIGIN_MODE === 'allowlist'
                ? { mode: env.HTTP_BROWSER_ORIGIN_MODE, origins: env.HTTP_BROWSER_ALLOWED_ORIGINS }
                : { mode: env.HTTP_BROWSER_ORIGIN_MODE }
        ),
        cors: {
            enabled: env.CORS_ENABLED,
            allowedMethods: env.CORS_ALLOWED_METHODS,
            allowedHeaders: env.CORS_ALLOWED_HEADERS,
            preflightMaxAgeSeconds: env.CORS_PREFLIGHT_MAX_AGE_SECONDS,
        },
        throttleTtlMs: env.THROTTLE_TTL_MS,
        throttleLimit: env.THROTTLE_LIMIT,
        requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
        requestIdHeader: env.REQUEST_ID_HEADER,
    }));

export const httpConfig = registerAs('http', () =>
    parseEnvironment(httpConfigValidateSchema, 'HTTP', {
        fields: { THROTTLE_LIMIT: { expected: 'a positive integer or Infinity' } },
        refinements: {
            'Expected a canonical HTTP(S) origin without a path':
                'a canonical HTTP(S) origin without a path',
            'Allowlist mode requires at least one origin':
                'at least one origin when HTTP_BROWSER_ORIGIN_MODE=allowlist',
            'Development origin modes require NODE_ENV=development':
                'NODE_ENV=development for development-* origin modes',
            'Production browser origins must use HTTPS': 'HTTPS origins when NODE_ENV=production',
        },
    })
);

export type HttpConfig = ConfigType<typeof httpConfig>;
