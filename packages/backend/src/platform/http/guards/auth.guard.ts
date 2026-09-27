import { extractAccessTokenFromRequest } from '@/common/utils/index.js';

import { AccessKernel } from '@/core/access/index.js';

import { AUTH_STRATEGY_KEY, AUTH_STRATEGY_TYPE } from '@/platform/http/decorators/index.js';

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
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

        const authStrategy = this.reflector.getAllAndOverride<AUTH_STRATEGY_TYPE>(
            AUTH_STRATEGY_KEY,
            [context.getHandler(), context.getClass()]
        );

        const accessToken = extractAccessTokenFromRequest(request);

        if (authStrategy === 'public') return true;

        if (authStrategy === 'optional') {
            if (!accessToken) return true;

            const claim = await this.accessKernel.verifyAccessToken({ accessToken });
            if (!claim) return true;

            request.jwtClaim = claim;
            return true;
        }

        if (!accessToken) {
            throw new UnauthorizedException('Missing access token');
        }

        const claim = await this.accessKernel.verifyAccessToken({ accessToken });
        if (!claim) {
            throw new UnauthorizedException('Invalid access token');
        }

        request.jwtClaim = claim;
        return true;
    }
}
