import { z } from 'zod';
import { ApiResponseContextSchema } from './context.js';
import { PublicErrorSchema, type ErrorContract } from './error.js';
import { UtcDateTimeSchema } from './scalar.js';

export const WsErrorMessageSchema = PublicErrorSchema.extend({
    kind: z.literal('error'),
    correlationId: z.string().min(1).optional(),
    timestamp: UtcDateTimeSchema,
    context: ApiResponseContextSchema.nullable(),
    retryAfterMs: z.number().nonnegative().optional(),
});

export function createWsErrorMessageSchema<S extends z.ZodType, const C extends string>(
    contract: ErrorContract<S, C>
) {
    return WsErrorMessageSchema.extend({
        code: z.literal(contract.code),
        message: z.literal(contract.message),
        details: contract.details,
    });
}

export type WsErrorMessage = z.infer<typeof WsErrorMessageSchema>;
