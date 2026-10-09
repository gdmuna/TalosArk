import { AllConfig } from '@/config/index.js';

import { AlsContextAdapter as RequestContextService } from '@/platform/context/als-context.adapter.js';

import { Logger, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpErrorPolicy, createHttpErrorResponse } from '../error/http-error.policy.js';
import { RequestError } from '@/platform/request/request.error.js';
import { toApiResponseContext } from '@/platform/context/response-context.js';
import { errorResponseSchema } from '../route/route.contract.js';
import { parseJsonResponse } from '../route/route.response.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Per NestJS docs (techniques/performance): middleware with Fastify receives raw
// Node.js objects via middie, not Fastify's wrappers.
type RawRequest = FastifyRequest['raw'];
type RawResponse = FastifyReply['raw'];

@Injectable()
export class RequestPreprocessingMiddleware implements NestMiddleware {
    constructor(private readonly configService: ConfigService<AllConfig, true>) {}

    use(req: RawRequest, res: RawResponse, next: () => void) {
        const requestIdHeader = this.configService.get('http.requestIdHeader', { infer: true });
        res.setHeader(requestIdHeader, String(req.id));
        req.version = this.configService.get('app.appVersion', { infer: true });
        next();
    }
}

@Injectable()
export class RequestScopeMiddleware implements NestMiddleware {
    constructor(private readonly requestContextService: RequestContextService) {}
    use(req: RawRequest, _: RawResponse, next: () => void) {
        const requestContext = {
            requestId: typeof req.id === 'string' ? req.id : String(req.id ?? 'unknown'),
            time: Date.now(),
            version: req.version,
            metadata: {},
        };
        this.requestContextService.run(requestContext, () => {
            next();
        });
    }
}

@Injectable()
export class CorsMiddleware implements NestMiddleware {
    private readonly logger = new Logger(CorsMiddleware.name);
    private readonly isDev: boolean;
    private readonly allowedOrigins: string[];
    private readonly allowedMethods: string;
    private readonly allowedHeaders: string;
    private readonly maxAge: number;
    private readonly errorReferenceUrl: string;

    constructor(
        configService: ConfigService<AllConfig, true>,
        private readonly errorPolicy: HttpErrorPolicy,
        private readonly requestContextService: RequestContextService
    ) {
        this.errorReferenceUrl = configService.get('observability.errorReferenceUrl', {
            infer: true,
        });
        this.isDev = configService.get('app.isDev', { infer: true });
        this.allowedOrigins = configService.get('http.corsAllowedOrigin', { infer: true });
        this.allowedMethods = configService
            .get('http.corsAllowedMethods', { infer: true })
            .join(', ');
        this.allowedHeaders = configService
            .get('http.corsAllowedHeaders', { infer: true })
            .join(', ');
        this.maxAge = configService.get('http.corsPreflightMaxAgeSeconds', { infer: true });
    }

    use(req: RawRequest, res: RawResponse, next: () => void) {
        const origin = req.headers.origin as string | undefined;

        const isAllowed =
            this.isDev ||
            !origin ||
            this.allowedOrigins.length === 0 ||
            this.allowedOrigins.includes(origin);

        if (!isAllowed) {
            this.logger.warn('CORS request blocked');
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            const { error } = this.errorPolicy.resolve(new RequestError({ reason: 'forbidden' }));
            const body = parseJsonResponse(
                errorResponseSchema(error.definition),
                createHttpErrorResponse(
                    error,
                    toApiResponseContext(this.requestContextService.get()),
                    this.errorReferenceUrl
                )
            );
            res.end(JSON.stringify(body));
            return;
        }

        res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Methods', this.allowedMethods);
            res.setHeader('Access-Control-Allow-Headers', this.allowedHeaders);
            res.setHeader('Access-Control-Max-Age', String(this.maxAge));
            res.statusCode = 204;
            res.end();
            return;
        }

        next();
    }
}
