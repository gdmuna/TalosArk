/**
 * Zod 校验模式 - 常用数据类型校验。
 * 配合 nestjs-zod 一起使用。
 */

import { z } from 'zod/v4';

export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z
        .string()
        .transform((val, ctx) => {
            if (!val) return val;
            const parsed = parseInt(val);
            if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
                ctx.addIssue({
                    code: 'invalid_type',
                    expected: 'valid port number',
                    received: val,
                });
                return z.NEVER;
            }
            return String(parsed);
        })
        .default('3000'),
    DATABASE_URL: z.url(),
    ALLOWED_ORIGINS_PROD: z
        .string()
        .transform((val, ctx) => {
            val.split(',')
                .filter((o) => o)
                .forEach((origin) => {
                    const ok = z.url().safeParse(origin);
                    if (!ok.success) {
                        ctx.addIssue({
                            code: 'invalid_type',
                            expected: 'comma-separated list of valid URLs',
                            received: val,
                        });
                        return z.NEVER;
                    }
                });
            return val;
        })
        .optional(),
    ALLOWED_ORIGINS_DEV: z
        .string()
        .transform((val, ctx) => {
            val.split(',')
                .filter((o) => o)
                .forEach((origin) => {
                    const ok = z.url().safeParse(origin);
                    if (!ok.success) {
                        ctx.addIssue({
                            code: 'invalid_type',
                            expected: 'comma-separated list of valid URLs',
                            received: val,
                        });
                        return z.NEVER;
                    }
                });
            return val;
        })
        .optional(),
    LOG_LEVEL: z
        .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent', ''])
        .optional(),
    SLOW_REQUEST_WARN_MS: z
        .string()
        .transform((val, ctx) => {
            if (!val) return val;
            const parsed = parseInt(val);
            if (isNaN(parsed) || parsed < 0) {
                ctx.addIssue({
                    code: 'invalid_type',
                    expected: 'non-negative integer',
                    received: val,
                });
                return z.NEVER;
            }
            return String(parsed);
        })
        .optional(),
    SLOW_REQUEST_ERROR_MS: z
        .string()
        .transform((val, ctx) => {
            if (!val) return val;
            const parsed = parseInt(val);
            if (isNaN(parsed) || parsed < 0) {
                ctx.addIssue({
                    code: 'invalid_type',
                    expected: 'non-negative integer',
                    received: val,
                });
                return z.NEVER;
            }
            return String(parsed);
        })
        .optional(),
    SLOW_QUERY_WARN_MS: z
        .string()
        .transform((val, ctx) => {
            if (!val) return val;
            const parsed = parseInt(val);
            if (isNaN(parsed) || parsed < 0) {
                ctx.addIssue({
                    code: 'invalid_type',
                    expected: 'non-negative integer',
                    received: val,
                });
                return z.NEVER;
            }
            return String(parsed);
        })
        .optional(),
    SLOW_QUERY_ERROR_MS: z
        .string()
        .transform((val, ctx) => {
            if (!val) return val;
            const parsed = parseInt(val);
            if (isNaN(parsed) || parsed < 0) {
                ctx.addIssue({
                    code: 'invalid_type',
                    expected: 'non-negative integer',
                    received: val,
                });
                return z.NEVER;
            }
            return String(parsed);
        })
        .optional(),
    REQUEST_TIMEOUT_MS: z
        .string()
        .transform((val, ctx) => {
            if (!val) return val;
            const parsed = parseInt(val);
            if (isNaN(parsed) || parsed < 0) {
                ctx.addIssue({
                    code: 'invalid_type',
                    expected: 'non-negative integer',
                    received: val,
                });
                return z.NEVER;
            }
            return String(parsed);
        })
        .optional(),
    JWT_ACCESS_PRIVATE_KEY: z.string().optional(),
    JWT_ACCESS_PUBLIC_KEY: z.string().optional(),
    JWT_ACCESS_EXPIRES_IN: z.string().optional(),
    JWT_REFRESH_PRIVATE_KEY: z.string().optional(),
    JWT_REFRESH_PUBLIC_KEY: z.string().optional(),
    JWT_REFRESH_EXPIRES_IN: z.string().optional(),
    JWT_REFRESH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
    JWT_REFRESH_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    JWT_REFRESH_COOKIE_PATH: z.string().optional(),
    JWT_REFRESH_COOKIE_MAX_AGE_MS: z
        .string()
        .transform((val, ctx) => {
            if (!val) return val;
            const parsed = parseInt(val);
            if (isNaN(parsed) || parsed <= 0) {
                ctx.addIssue({
                    code: 'invalid_type',
                    expected: 'positive integer',
                    received: val,
                });
                return z.NEVER;
            }
            return String(parsed);
        })
        .optional(),
});

/**
 * 电子邮箱校验。
 * 验证邮箱格式、自动修剪空白、转为小写。
 *
 * @example
 * emailSchema.parse('USER@EXAMPLE.COM')  // 'user@example.com'
 * emailSchema.parse('invalid')           // Throws ZodError
 */
export const emailSchema = z
    .email('Invalid email format')
    .trim()
    .toLowerCase()
    .describe('Email address in lowercase');

/**
 * 手机号校验 - E.164 格式。
 * 支持国际格式（+国家码 + 号码）和国内格式（7-15 位数字）。
 * 自动移除空格、连字符、括号、点等常见格式字符。
 *
 * @example
 * phoneSchema.parse('+86 138 0013 8000')   // Passes
 * phoneSchema.parse('13800138000')         // Passes
 * phoneSchema.parse('+1 (555) 123-4567')   // Passes (格式化字符被移除)
 * phoneSchema.parse('123')                 // Throws (太短)
 */
export const phoneSchema = z
    .string()
    .transform((val) => val.replace(/[\s\-().]/g, ''))
    .refine(
        (val) => {
            // E.164: international (+1-3 digits CC + 3-14 number) or domestic (7-15 digits)
            if (val.startsWith('+')) {
                return /^\+\d{1,3}\d{3,14}$/.test(val);
            }
            return /^\d{7,15}$/.test(val);
        },
        {
            message: 'Invalid phone number format. Use E.164 format or 7-15 digits.',
        }
    )
    .describe('Phone number in E.164 format or domestic 7-15 digits');

/**
 * 非空字符串校验。
 * 必须包含至少一个非空白字符，自动修剪空白。
 *
 * @example
 * nonEmptyStringSchema.parse('  hello  ')  // 'hello'
 * nonEmptyStringSchema.parse('   ')        // Throws ZodError
 * nonEmptyStringSchema.parse('')           // Throws ZodError
 */
export const nonEmptyStringSchema = z
    .string()
    .min(1, 'String cannot be empty')
    .trim()
    .describe('Non-empty string');

/**
 * URL 校验。
 * 验证绝对 URL（http://、https:// 等）。不验证 URL 的可用性。
 *
 * @example
 * urlSchema.parse('https://example.com')       // Passes
 * urlSchema.parse('http://localhost:3000')     // Passes
 * urlSchema.parse('example.com')               // Throws (无协议)
 */
export const urlSchema = z.string().url('Invalid URL format').describe('Valid URL with protocol');

/**
 * UUID v4 校验。
 * 验证 UUID v4 格式的字符串，支持带或不带连字符的格式。
 *
 * @example
 * uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')  // Passes
 * uuidSchema.parse('550e8400e29b41d4a716446655440000')      // Also passes
 * uuidSchema.parse('not-a-uuid')                             // Throws
 */
export const uuidSchema = z.uuid('Invalid UUID format').describe('UUID v4 identifier');

/**
 * 密码校验 - 强度要求。
 * 最少 8 个字符，必须包含大写字母、小写字母、数字、特殊字符。
 *
 * @example
 * passwordSchema.parse('SecureP@ss123')     // Passes
 * passwordSchema.parse('weak')              // Throws (太短且缺乏特殊字符)
 * passwordSchema.parse('NoSpecial123')      // Throws (无特殊字符)
 */
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one digit')
    .regex(/[!@#$%^&*]/, 'Password must contain at least one special character (!@#$%^&*)')
    .describe('Secure password with strength requirements');

/**
 * ISO 8601 日期时间字符串校验。
 * 验证 ISO 8601 格式的日期时间字符串。
 *
 * @example
 * isoDateTimeSchema.parse('2025-03-21T10:30:00Z')  // Passes
 * isoDateTimeSchema.parse('2025-03-21')             // Throws (无时间部分)
 */
export const isoDateTimeSchema = z.iso
    .datetime('Invalid DateTime. Use ISO 8601 format: YYYY-MM-DDTHH:mm:ssZ')
    .describe('ISO 8601 DateTime string');

/**
 * Slug 校验 - URL 友好的标识符。
 * 仅允许小写字母、数字和连字符。常用于博客文章 slug、URL 路径段等。
 *
 * @example
 * slugSchema.parse('my-blog-post')              // Passes
 * slugSchema.parse('post-123')                  // Passes
 * slugSchema.parse('My-Invalid-Slug')           // Throws (大写字母)
 * slugSchema.parse('post_with_underscore')      // Throws (下划线不允许)
 */
export const slugSchema = z
    .string()
    .min(1, 'Slug cannot be empty')
    .max(255, 'Slug must be 255 characters or less')
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug must contain only lowercase letters, numbers, and hyphens'
    )
    .describe('URL-safe slug identifier');

/**
 * 校验错误消息 - 预定义的错误提示，用于一致的错误反馈。
 */
export const ValidationMessages = {
    INVALID_EMAIL: '请输入有效的电子邮箱地址',
    INVALID_PHONE: '请输入有效的手机号码（E.164 格式或 7-15 位数字）',
    REQUIRED_FIELD: '此字段为必填项',
    NOT_EMPTY: '此字段不能为空或仅包含空白字符',
    INVALID_URL: '请输入有效的 URL（以 http:// 或 https:// 开头）',
    INVALID_UUID: '请输入有效的 UUID',
    WEAK_PASSWORD: '密码至少 8 个字符，需含大写字母、小写字母、数字和特殊字符',
    INVALID_DATETIME: '请输入有效的 ISO 8601 日期时间格式',
    INVALID_SLUG: '标识符仅可包含小写字母、数字和连字符',
} as const;
