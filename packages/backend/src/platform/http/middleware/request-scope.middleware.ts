import { AlsContextAdapter as RequestContextService } from '@/platform/context/als-context.adapter.js';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

type RawRequest = FastifyRequest['raw'];
type RawResponse = FastifyReply['raw'];

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
