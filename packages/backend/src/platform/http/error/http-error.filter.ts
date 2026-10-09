import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AllConfig } from '@/config/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { toApiResponseContext } from '@/platform/context/response-context.js';
import { HttpErrorPolicy, createHttpErrorResponse } from './http-error.policy.js';
import { normalizeHttpError } from './http-error.normalize.js';
import { ErrorResolver } from '@/platform/error/error.resolver.js';
import { createErrorDiagnostic } from '@/platform/error/error.diagnostic.js';
import { ApiResponseContextSchema } from '@talos-ark/contracts/protocol';
import { REQUEST_ROUTE_CONTRACT, errorResponseSchema } from '../route/route.contract.js';
import { parseJsonResponse, RouteResponseError } from '../route/route.response.js';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
    constructor(
        private readonly policy: HttpErrorPolicy,
        private readonly resolver: ErrorResolver,
        private readonly context: AlsContextAdapter,
        private readonly config: ConfigService<AllConfig, true>,
        @InjectPinoLogger(HttpErrorFilter.name) private readonly logger: PinoLogger
    ) {}

    catch(exception: unknown, host: ArgumentsHost): void {
        const http = host.switchToHttp();
        const request = http.getRequest<FastifyRequest>();
        const response = http.getResponse<FastifyReply>();
        const contract = request[REQUEST_ROUTE_CONTRACT];
        let { error, status, retryAfterSeconds } = this.policy.resolve(
            normalizeHttpError(exception),
            contract?.errors
        );
        const sent = response.sent || response.raw.headersSent;
        let body: unknown;
        if (!sent) {
            const context = toApiResponseContext(this.context.get()) ?? {
                requestId: request.id,
                time: Date.now(),
                version: this.config.get('app.appVersion', { infer: true }),
            };
            const referenceUrl = this.config.get('observability.errorReferenceUrl', {
                infer: true,
            });
            try {
                const schema = contract
                    ? contract.responses.get(status)?.schema
                    : errorResponseSchema(error.definition);
                if (!schema) throw new RouteResponseError({ reason: 'undeclared-status', status });
                body = parseJsonResponse(
                    schema,
                    createHttpErrorResponse(error, context, referenceUrl)
                );
            } catch (resolutionError) {
                error = this.resolver.internal(exception, resolutionError);
                status = 500;
                retryAfterSeconds = undefined;
                // A broken response/context must not recursively fail the exception filter.
                const safeContext = ApiResponseContextSchema.safeParse(context);
                body = parseJsonResponse(
                    errorResponseSchema(error.definition),
                    createHttpErrorResponse(
                        error,
                        safeContext.success ? safeContext.data : null,
                        referenceUrl
                    )
                );
            }
        }
        // Log even when a stream has already sent its headers; never send a second response.
        const diagnostic = createErrorDiagnostic(error);
        this.logger[diagnostic.level](
            {
                ...diagnostic.data,
                status,
                requestId: request.id,
                method: request.method,
                route: request.routeOptions?.url,
                responseSent: sent,
            },
            diagnostic.message
        );
        if (sent) return;
        if (retryAfterSeconds !== undefined && !response.hasHeader('Retry-After')) {
            response.header('Retry-After', Math.ceil(retryAfterSeconds));
        }
        response.code(status).send(body);
    }
}
