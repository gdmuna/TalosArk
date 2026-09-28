import { z } from 'zod';
import { UtcDateTimeSchema } from './scalar.js';

export const ApiResponseContextSchema = z.object({
    requestId: z.string().min(1),
    time: z.int().nonnegative().describe('Request start time in Unix milliseconds'),
    version: z.string().optional(),
    userId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ApiSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.unknown(),
    timestamp: UtcDateTimeSchema,
    context: ApiResponseContextSchema.nullable(),
});

export const ApiErrorResponseSchema = z.object({
    success: z.literal(false),
    code: z.string(),
    message: z.string(),
    type: z.url().describe('Error documentation URL'),
    timestamp: UtcDateTimeSchema,
    context: ApiResponseContextSchema.nullable(),
    details: z.unknown(),
});

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

export type ApiResponseContext = z.infer<typeof ApiResponseContextSchema>;
export type ApiSuccessResponse<T = unknown> = Omit<
    z.infer<typeof ApiSuccessResponseSchema>,
    'data'
> & { data: T };
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
