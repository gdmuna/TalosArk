import type { AllConfig } from '@/config/index.js';

import { AlsContextAdapter as RequestContextService } from '@/platform/context/als-context.adapter.js';
import { toApiResponseContext } from '@/platform/context/response-context.js';
import { RequestError } from '@/platform/request/request.error.js';
import { HttpErrorPolicy, createHttpErrorResponse } from '../error/http.error.policy.js';
import { errorResponseSchema } from '../route/route.contract.js';
import { parseJsonResponse } from '../route/route.response.js';
import { isAllowedBrowserOrigin } from '../browser-origin.policy.js';
import type { BrowserOriginPolicy } from '@/config/http.config.js';

import { Logger, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest, FastifyReply } from 'fastify';

type RawRequest = FastifyRequest['raw'];
type RawResponse = FastifyReply['raw'];

@Injectable()
export class CorsMiddleware implements NestMiddleware {
    private readonly logger = new Logger(CorsMiddleware.name);
    private readonly enabled: boolean;
    private readonly originPolicy: BrowserOriginPolicy;
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
        this.enabled = configService.get('http.cors.enabled', { infer: true });
        this.originPolicy = configService.get('http.browserOriginPolicy', { infer: true });
        if (this.originPolicy.mode === 'development-any')
            this.logger.warn('Development browser origin policy trusts every HTTP(S) origin');
        this.allowedMethods = configService
            .get('http.cors.allowedMethods', { infer: true })
            .join(', ');
        this.allowedHeaders = configService
            .get('http.cors.allowedHeaders', { infer: true })
            .join(', ');
        this.maxAge = configService.get('http.cors.preflightMaxAgeSeconds', { infer: true });
    }

    use(req: RawRequest, res: RawResponse, next: () => void) {
        if (!this.enabled) return next();
        const origin = req.headers.origin as string | undefined;
        const vary = String(res.getHeader('Vary') ?? '');
        if (!vary.split(',').some((field) => ['origin', '*'].includes(field.trim().toLowerCase())))
            res.setHeader('Vary', vary ? `${vary}, Origin` : 'Origin');
        const isAllowed = origin === undefined || isAllowedBrowserOrigin(origin, this.originPolicy);

        if (!isAllowed) {
            this.logger.warn('CORS request blocked');
            res.statusCode = 403;
            res.setHeader('Cache-Control', 'no-store');
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

        if (origin !== undefined) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }

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
