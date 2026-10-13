import type { z } from 'zod';
import { RequestError, validationIssues } from '@/platform/request/request.error.js';

export type CookieSelector = string | readonly string[];

export interface CookieOptions {
    schema?: z.ZodType;
    onFailure?: 'throw' | 'undefined';
}

export interface CookieBinding {
    readonly selector?: CookieSelector;
    readonly schema?: z.ZodType;
    readonly onFailure: 'throw' | 'undefined';
}

export function createCookieBinding(
    selector: CookieSelector | undefined,
    options: CookieOptions = {}
): CookieBinding {
    const validName = (name: unknown) => typeof name === 'string' && name.length > 0;
    if (
        selector !== undefined &&
        !(typeof selector === 'string' && validName(selector)) &&
        !(Array.isArray(selector) && selector.every(validName))
    ) {
        throw new TypeError('Cookie selector must be a nonempty name or an array of names');
    }
    const onFailure = options.onFailure ?? 'throw';
    if (onFailure !== 'throw' && onFailure !== 'undefined') {
        throw new TypeError('Invalid Cookie onFailure policy');
    }
    if (options.schema !== undefined && typeof options.schema.safeParseAsync !== 'function') {
        throw new TypeError('Cookie schema must be a Zod schema');
    }
    return Object.freeze({
        selector:
            typeof selector === 'string' || selector === undefined
                ? selector
                : Object.freeze([...selector]),
        schema: options.schema,
        onFailure,
    });
}

export async function extractCookie(
    cookies: Record<string, string | undefined> | null | undefined,
    binding: CookieBinding
): Promise<unknown> {
    if (cookies === null || cookies === undefined) {
        throw new Error('Cookie parser has not initialized request.cookies');
    }
    const { selector, schema, onFailure } = binding;
    const names =
        selector === undefined
            ? Object.keys(cookies)
            : typeof selector === 'string'
              ? [selector]
              : selector;
    const selected: Record<string, string> = Object.create(null);
    const missing: string[] = [];
    for (const name of names) {
        const value = Object.hasOwn(cookies, name) ? cookies[name] : undefined;
        if (value === undefined) missing.push(name);
        else selected[name] = value;
    }
    const input = typeof selector === 'string' ? selected[selector] : selected;
    if (schema) {
        // Only a returned validation failure is softened; thrown schema bugs propagate.
        const result = await schema.safeParseAsync(input);
        if (result.success) return result.data;
        if (onFailure === 'undefined') return undefined;
        const issues = validationIssues(result.error).map((issue) => ({
            ...issue,
            path: typeof selector === 'string' ? [selector, ...issue.path] : issue.path,
        }));
        throw new RequestError(
            { reason: 'validation', details: { issues } },
            { cause: result.error }
        );
    }
    if (missing.length > 0) {
        if (onFailure === 'undefined') return undefined;
        throw new RequestError({
            reason: 'validation',
            details: {
                issues: missing.map((name) => ({
                    path: [name],
                    code: 'missing_cookie',
                    message: 'Required cookie is missing',
                })),
            },
        });
    }
    return input;
}
