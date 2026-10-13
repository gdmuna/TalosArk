import { extractAccessTokenFromRequest } from '../credential.js';

import { AccessKernel } from '@/core/access/index.js';

import { AUTH_STRATEGY_KEY, AUTH_STRATEGY_TYPE } from '@/platform/http/decorators/index.js';

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { RequestError } from '@/platform/request/request.error.js';
import { Reflector } from '@nestjs/core';

import { FastifyRequest } from 'fastify';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly accessKernel: AccessKernel
    ) {}

    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        request.authentication = null;

        const authStrategy = this.reflector.getAllAndOverride<AUTH_STRATEGY_TYPE>(
            AUTH_STRATEGY_KEY,
            [context.getHandler(), context.getClass()]
        );

        const accessToken = extractAccessTokenFromRequest(request);

        if (authStrategy === 'public') return true;

        if (!accessToken) {
            if (authStrategy === 'optional') return true;
            throw new RequestError({ reason: 'authentication' });
        }

        const claim = await this.accessKernel.verifyAccessToken({ accessToken });
        if (!claim) {
            if (authStrategy === 'optional') return true;
            throw new RequestError({ reason: 'authentication' });
        }

        request.authentication = Object.freeze({
            userId: claim.sub,
            sessionId: claim.sid,
        });
        return true;
    }
}
