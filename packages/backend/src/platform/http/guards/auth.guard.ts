import { AUTH_STRATEGY_KEY, AUTH_STRATEGY_TYPE } from '@/platform/http/decorators/index.js';
import { extractAccessTokenFromRequest } from '@/common/utils/index.js';

import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<FastifyRequest>();

        const authStrategy = this.reflector.getAllAndOverride<AUTH_STRATEGY_TYPE>(
            AUTH_STRATEGY_KEY,
            [context.getHandler(), context.getClass()]
        );

        const accessToken = extractAccessTokenFromRequest(request);

        if (authStrategy === 'public') return true;

        if (authStrategy === 'optional') {
            if (!accessToken) return true;

            const claim = this.verifyAccessToken(accessToken);
            if (!claim) return true;

            request.jwtClaim = claim as never;
            return true;
        }

        if (!accessToken) {
            throw new UnauthorizedException('Missing access token');
        }

        const claim = this.verifyAccessToken(accessToken);
        if (!claim) {
            throw new UnauthorizedException('Invalid access token');
        }

        request.jwtClaim = claim as never;
        return true;
    }

    private verifyAccessToken(_accessToken: string): never {
        throw new ServiceUnavailableException('Identity verification is not available');
    }
}
