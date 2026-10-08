import { z } from 'zod';
import { UtcDateTimeSchema } from './scalar.js';
import { ApiResponseContextSchema } from './context.js';
import { PublicErrorSchema, type ErrorContract } from './error.js';

export const ApiSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.unknown(),
    timestamp: UtcDateTimeSchema,
    context: ApiResponseContextSchema.nullable(),
});

export const ApiErrorResponseSchema = PublicErrorSchema.extend({
    success: z.literal(false),
    type: z.url().describe('Error documentation URL'),
    timestamp: UtcDateTimeSchema,
    context: ApiResponseContextSchema.nullable(),
});

export function createApiErrorResponseSchema<S extends z.ZodType, const C extends string>(
    contract: ErrorContract<S, C>
) {
    return ApiErrorResponseSchema.extend({
        code: z.literal(contract.code),
        details: contract.details,
    });
}

export function createApiSuccessResponseSchema<T extends z.ZodType>(dataSchema: T) {
    return ApiSuccessResponseSchema.extend({ data: dataSchema });
}

export function createApiResponseSchema<T extends z.ZodType>(dataSchema: T) {
    return z.discriminatedUnion('success', [
        createApiSuccessResponseSchema(dataSchema),
        ApiErrorResponseSchema,
    ]);
}

export const ApiResponseSchema = createApiResponseSchema(z.unknown());

export type ApiSuccessResponse<T = unknown> = Omit<
    z.infer<typeof ApiSuccessResponseSchema>,
    'data'
> & { data: T };
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
