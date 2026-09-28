import { ValidationFailedException } from '@/platform/errors/client.exception.js';
import type { FieldError } from '@/platform/errors/client.exception.js';

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { z } from 'zod/v4';
import type { FastifyRequest } from 'fastify';

type CookieSelector = { schema: z.ZodType } | z.ZodType | string | string[] | undefined;

/**
 * 从请求中提取 cookie 对象（`req.cookies`），可选地传入 DTO 类、Zod schema、单个 key 或多个 key 进行选择和校验。
 *
 * @example
 * // 传入 createZodDto 生成的 DTO 类，自动校验
 * async handler(@Cookie(RefreshTokenCookieDto) cookies: RefreshTokenCookieDto) {}
 *
 * // 提取单个 cookie
 * async handler(@Cookie('refresh_token') token: string) {}
 *
 * // 提取多个 cookie
 * async handler(@Cookie(['refresh_token', 'session']) cookies: { refresh_token: string; session: string }) {}
 *
 * // 不校验，直接获取原始 cookie map
 * async handler(@Cookie() cookies: Record<string, string>) {}
 */
export const Cookie = createParamDecorator((selector: CookieSelector, ctx: ExecutionContext) => {
    const cookies = ctx.switchToHttp().getRequest<FastifyRequest>().cookies;

    if (!selector) return cookies;

    if (typeof selector === 'string') {
        const cookieValue = cookies[selector];
        if (cookieValue === undefined) {
            throw new ValidationFailedException({
                message: `缺少必需的 Cookie: ${selector}`,
            });
        }
        return cookieValue;
    }

    if (Array.isArray(selector)) {
        const result: Record<string, string> = {};
        for (const cookieName of selector) {
            const cookieValue = cookies[cookieName];
            if (cookieValue === undefined) {
                throw new ValidationFailedException({
                    message: `缺少必需的 Cookie: ${cookieName}`,
                });
            }
            result[cookieName] = cookieValue;
        }
        return result;
    }

    const schema: z.ZodType =
        'schema' in selector ? (selector as { schema: z.ZodType }).schema : (selector as z.ZodType);

    const result = schema.safeParse(cookies);
    if (!result.success) {
        const fieldErrors: FieldError[] = result.error.issues.map((issue) => ({
            field: issue.path.join('.') || '(cookie)',
            message: issue.message,
            code: issue.code,
        }));
        throw new ValidationFailedException({ details: fieldErrors });
    }

    return result.data;
});
