import {
    Injectable,
    type CallHandler,
    type ExecutionContext,
    type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { mergeMap } from 'rxjs/operators';
import { z } from 'zod';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { toApiResponseContext } from '@/platform/context/response-context.js';
import { RequestError, validationIssues } from '@/platform/request/request.error.js';
import { ROUTE_CONTRACT_KEY, type RouteContract } from './route.contract.js';
import { parseJsonResponseAsync, RouteResponseError } from './route.response.js';

@Injectable()
export class RouteContractInterceptor implements NestInterceptor {
    constructor(
        private readonly reflector: Reflector,
        private readonly context: AlsContextAdapter
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler) {
        const contract = this.reflector.get<RouteContract>(
            ROUTE_CONTRACT_KEY,
            context.getHandler()
        );
        if (!contract) return next.handle();
        const http = context.switchToHttp();
        const request = http.getRequest<FastifyRequest>();
        const reply = http.getResponse<FastifyReply>();

        // Run before Nest extracts @Body/@Query/@Param values, including projected fields.
        for (const source of ['body', 'query', 'params', 'headers'] as const) {
            const schema = contract.request[source];
            if (!schema) continue;
            try {
                const parsed = await schema.parseAsync(request[source]);
                if (source === 'headers') Object.assign(request.headers, parsed);
                else request[source] = parsed;
            } catch (cause) {
                if (!(cause instanceof z.ZodError)) throw cause;
                throw new RequestError(
                    {
                        reason: 'validation',
                        details: {
                            issues: validationIssues(cause).map((issue) => ({
                                ...issue,
                                path: [source, ...issue.path],
                            })),
                        },
                    },
                    { cause }
                );
            }
        }

        return next.handle().pipe(
            mergeMap(async (data: unknown) => {
                const status = reply.statusCode;
                const response = contract.responses.get(status);
                if (!response || status >= 400) {
                    throw new RouteResponseError({ reason: 'undeclared-status', status });
                }
                if (!response.schema) {
                    if (data !== undefined && data !== null) {
                        throw new RouteResponseError({ reason: 'body-not-allowed', status });
                    }
                    return undefined;
                }
                try {
                    return await parseJsonResponseAsync(response.schema, {
                        success: true,
                        data: data ?? null,
                        timestamp: new Date().toISOString(),
                        context: toApiResponseContext(this.context.get()),
                    });
                } catch (cause) {
                    throw new RouteResponseError({ reason: 'invalid-body', status }, { cause });
                }
            })
        );
    }
}
