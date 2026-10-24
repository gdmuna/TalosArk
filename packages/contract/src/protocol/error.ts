import { z } from 'zod';

export interface ErrorContract<S extends z.ZodType = z.ZodType, C extends string = string> {
    readonly code: C;
    readonly message: string;
    readonly details: S;
}

export function defineErrorContract<const C extends string, S extends z.ZodType>(
    code: C,
    message: string,
    details: S
) {
    return { code, message, details } as const;
}

export type ErrorLogLevel = 'info' | 'warn' | 'error';

export interface ErrorProtocol {
    readonly http?: { readonly status?: number; readonly retryAfterSeconds?: number };
    readonly ws?: { readonly closeCode?: number; readonly retryAfterMs?: number };
}

export interface ErrorSpecification {
    readonly public?: ErrorContract;
    readonly protocol?: ErrorProtocol;
    readonly internal?: { readonly logLevel?: ErrorLogLevel };
}

export interface ErrorDefinition extends ErrorSpecification {
    readonly id: string;
    readonly reason: string;
}

export type ErrorCatalog = Readonly<Record<string, ErrorDefinition>>;

export function defineErrorCatalog<
    const Scope extends string,
    const Specification extends Record<string, ErrorSpecification>,
>(scope: Scope, specification: Specification) {
    if (!/^[a-z][a-z0-9-]*$/.test(scope)) throw new TypeError('Invalid error scope');
    const entries = Object.entries(specification).map(([reason, value]) => {
        if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(reason)) throw new TypeError('Invalid error reason');
        const http = value.protocol?.http;
        const ws = value.protocol?.ws;
        if (
            http?.status !== undefined &&
            (!Number.isInteger(http.status) || http.status < 400 || http.status > 599)
        )
            throw new TypeError(`Invalid HTTP error status: ${scope}.${reason}`);
        for (const duration of [http?.retryAfterSeconds, ws?.retryAfterMs]) {
            if (duration !== undefined && (!Number.isFinite(duration) || duration < 0))
                throw new TypeError(`Invalid error retry delay: ${scope}.${reason}`);
        }
        if (
            ws?.closeCode !== undefined &&
            (!Number.isInteger(ws.closeCode) ||
                !(
                    [
                        1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014,
                    ].includes(ws.closeCode) ||
                    (ws.closeCode >= 3000 && ws.closeCode <= 4999)
                ))
        )
            throw new TypeError(`Invalid WebSocket close code: ${scope}.${reason}`);
        if (
            value.internal?.logLevel !== undefined &&
            !['info', 'warn', 'error'].includes(value.internal.logLevel)
        )
            throw new TypeError(`Invalid error log level: ${scope}.${reason}`);
        if (value.public && (!value.public.code || !value.public.message))
            throw new TypeError(`Invalid public error: ${scope}.${reason}`);
        return [
            reason,
            Object.freeze({
                ...value,
                ...(value.public ? { public: Object.freeze({ ...value.public }) } : {}),
                ...(value.protocol
                    ? {
                          protocol: Object.freeze({
                              ...(http ? { http: Object.freeze({ ...http }) } : {}),
                              ...(ws ? { ws: Object.freeze({ ...ws }) } : {}),
                          }),
                      }
                    : {}),
                ...(value.internal ? { internal: Object.freeze({ ...value.internal }) } : {}),
                id: `${scope}.${reason}`,
                reason,
            }),
        ];
    });
    return Object.freeze(Object.fromEntries(entries)) as {
        readonly [Reason in keyof Specification]: Readonly<Specification[Reason]> & {
            readonly id: `${Scope}.${Reason & string}`;
            readonly reason: Reason;
        };
    };
}

export const PublicErrorSchema = z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.json(),
});

export const ValidationIssueSchema = z.object({
    path: z.array(z.union([z.string(), z.int()])),
    code: z.string(),
    message: z.string(),
});

export const RequestErrorContract = {
    validation: defineErrorContract(
        'REQUEST_VALIDATION_FAILED',
        'Request validation failed',
        z.object({ issues: z.array(ValidationIssueSchema) })
    ),
    authentication: defineErrorContract(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        z.null()
    ),
    forbidden: defineErrorContract('REQUEST_FORBIDDEN', 'Request forbidden', z.null()),
    notFound: defineErrorContract('REQUEST_NOT_FOUND', 'Resource not found', z.null()),
    rateLimited: defineErrorContract('REQUEST_RATE_LIMITED', 'Too many requests', z.null()),
    payloadTooLarge: defineErrorContract(
        'REQUEST_PAYLOAD_TOO_LARGE',
        'Request payload too large',
        z.null()
    ),
    unsupportedContent: defineErrorContract(
        'REQUEST_UNSUPPORTED_CONTENT',
        'Unsupported content type',
        z.null()
    ),
    processingTimeout: defineErrorContract(
        'REQUEST_PROCESSING_TIMEOUT',
        'Request processing timed out',
        z.null()
    ),
    notImplemented: defineErrorContract(
        'REQUEST_NOT_IMPLEMENTED',
        'Operation not implemented',
        z.null()
    ),
    invalid: defineErrorContract('REQUEST_INVALID', 'Invalid request', z.null()),
    internal: defineErrorContract('SYS_INTERNAL_ERROR', 'An internal error occurred', z.null()),
} as const;

export type PublicError = z.infer<typeof PublicErrorSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
