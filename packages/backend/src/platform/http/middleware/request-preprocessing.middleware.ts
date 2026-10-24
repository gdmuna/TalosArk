import type { AllConfig } from '@/config/index.js';

import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Fastify middleware receives the raw Node.js request and response.
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
