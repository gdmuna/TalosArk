import {
    createParamDecorator,
    type ExecutionContext,
    type PipeTransform,
    type Type,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
    createCookieBinding,
    extractCookie,
    type CookieBinding,
    type CookieOptions,
    type CookieSelector,
} from './cookie.extract.js';

export type { CookieOptions, CookieSelector } from './cookie.extract.js';

const bindCookie = createParamDecorator((binding: CookieBinding, ctx: ExecutionContext) => {
    const cookies = ctx.switchToHttp().getRequest<FastifyRequest>().cookies;
    return extractCookie(cookies, binding);
});

/**
 * Select one name, multiple names, or the complete parsed Cookie map.
 * Schemas validate the selected value; use z.output types rather than DTO classes
 * to avoid implicit validation by the global DTO pipe. Extra pipes run independently.
 */
export function Cookie(
    selector?: CookieSelector,
    options: CookieOptions = {},
    ...pipes: (PipeTransform | Type<PipeTransform>)[]
): ParameterDecorator {
    return bindCookie(createCookieBinding(selector, options), ...pipes);
}
