import { z } from 'zod';
import { ApiResponseContextSchema } from './context.js';
import { PublicErrorSchema, type ErrorContract } from './error.js';
import { UtcDateTimeSchema } from './scalar.js';

export const WsErrorMessageSchema = PublicErrorSchema.extend({
    kind: z.literal('error'),
    correlationId: z.string().min(1).optional(),
    timestamp: UtcDateTimeSchema,
    context: ApiResponseContextSchema.nullable(),
});

export function createWsErrorMessageSchema<S extends z.ZodType, const C extends string>(
    contract: ErrorContract<S, C>
) {
    return WsErrorMessageSchema.extend({
        code: z.literal(contract.code),
        details: contract.details,
    });
}

export type WsErrorMessage = z.infer<typeof WsErrorMessageSchema>;
