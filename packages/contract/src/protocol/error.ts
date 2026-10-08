import { z } from 'zod';

export interface ErrorContract<S extends z.ZodType = z.ZodType, C extends string = string> {
    readonly code: C;
    readonly details: S;
}

export function defineErrorContract<const C extends string, S extends z.ZodType>(
    code: C,
    details: S
) {
    return { code, details } as const;
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
        z.object({ issues: z.array(ValidationIssueSchema) })
    ),
    authentication: defineErrorContract('AUTHENTICATION_REQUIRED', z.null()),
    forbidden: defineErrorContract('REQUEST_FORBIDDEN', z.null()),
    notFound: defineErrorContract('REQUEST_NOT_FOUND', z.null()),
    rateLimited: defineErrorContract('REQUEST_RATE_LIMITED', z.null()),
    payloadTooLarge: defineErrorContract('REQUEST_PAYLOAD_TOO_LARGE', z.null()),
    unsupportedContent: defineErrorContract('REQUEST_UNSUPPORTED_CONTENT', z.null()),
    processingTimeout: defineErrorContract('REQUEST_PROCESSING_TIMEOUT', z.null()),
    notImplemented: defineErrorContract('REQUEST_NOT_IMPLEMENTED', z.null()),
    invalid: defineErrorContract('REQUEST_INVALID', z.null()),
    internal: defineErrorContract('SYS_INTERNAL_ERROR', z.null()),
} as const;

export type PublicError = z.infer<typeof PublicErrorSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
