import { HttpException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { RequestError, validationIssues } from '@/platform/request/request.error.js';

export function normalizeHttpError(error: unknown): unknown {
    if (error instanceof ZodSerializationException) return error;
    if (error instanceof ZodValidationException) {
        const zodError = error.getZodError();
        return new RequestError(
            {
                reason: 'validation',
                details: {
                    issues: zodError instanceof z.ZodError ? validationIssues(zodError) : [],
                },
            },
            { cause: error }
        );
    }
    if (error instanceof ThrottlerException) {
        return new RequestError({ reason: 'rateLimited' }, { cause: error });
    }
    const status = error instanceof HttpException ? error.getStatus() : undefined;
    const reason = {
        400: 'invalid',
        401: 'authentication',
        403: 'forbidden',
        404: 'notFound',
        413: 'payloadTooLarge',
        415: 'unsupportedContent',
        429: 'rateLimited',
        501: 'notImplemented',
    } as const;
    if (status !== undefined && status in reason) {
        return new RequestError(
            { reason: reason[status as keyof typeof reason] },
            { cause: error }
        );
    }
    // Only recognize Fastify's own parser errors, not arbitrary objects with a statusCode.
    if (error instanceof Error && 'code' in error) {
        switch (error.code) {
            case 'FST_ERR_CTP_BODY_TOO_LARGE':
                return new RequestError({ reason: 'payloadTooLarge' }, { cause: error });
            case 'FST_ERR_CTP_INVALID_MEDIA_TYPE':
                return new RequestError({ reason: 'unsupportedContent' }, { cause: error });
            case 'FST_ERR_CTP_INVALID_JSON_BODY':
            case 'FST_ERR_CTP_EMPTY_JSON_BODY':
                return new RequestError({ reason: 'invalid' }, { cause: error });
        }
    }
    return error;
}
