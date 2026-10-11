import { type FastifyReply, type FastifyRequest } from 'fastify';
import {
    OidcLoginCallbackBodySchema,
    OidcLoginCallbackResponseSchema,
    OidcStartResponseSchema,
    SessionRefreshBodySchema,
    SessionRefreshResponseSchema,
    type OidcLoginCallbackBody,
    type OidcLoginCallbackResponse,
    type OidcStartResponse,
    type SessionCredentials,
    type SessionRefreshBody,
    type SessionRefreshResponse,
} from '@talos-ark/contracts/auth';
import { AuthService } from './auth.service.js';
import { IdentityErrorDefinition, AccessErrorDefinition } from '@talos-ark/contracts/backend';

import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Cookie } from '@/platform/http/decorators/cookie.decorator.js';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { RequestError } from '@/platform/request/request.error.js';
import type { CreateUserSessionOutput } from '@/core/access/access.contract.js';

function toSessionCredentials({ session, tokenPair }: CreateUserSessionOutput): SessionCredentials {
    return {
        session: {
            id: session.id,
            userId: session.userId,
            version: session.version,
            idleExpiresAt: session.idleExpiresAt.toISOString(),
        },
        tokenPair: {
            id: tokenPair.id,
            accessToken: {
                value: tokenPair.accessToken.value,
                expiresAt: tokenPair.accessToken.expiresAt.toISOString(),
            },
            refreshToken: {
                value: tokenPair.refreshToken.value,
                expiresAt: tokenPair.refreshToken.expiresAt.toISOString(),
            },
        },
    };
}

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('oidc/start')
    @ApiRoute({
        auth: 'public',
        summary: 'Start OIDC login',
        errors: [
            IdentityErrorDefinition['login-unavailable'],
            IdentityErrorDefinition['provider-unavailable'],
        ],
        responses: [{ status: 201, schema: OidcStartResponseSchema }],
    })
    async oidcStart(@Res({ passthrough: true }) res: FastifyReply): Promise<OidcStartResponse> {
        const { transactionId, url } = await this.authService.oidcStart();
        res.cookie('talosArk_oidc_transaction', transactionId, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 10 * 60,
        });
        return { url };
    }

    @Post('oidc/login-callback')
    @ApiRoute({
        auth: 'public',
        summary: 'Complete OIDC login',
        errors: [
            IdentityErrorDefinition['transaction-invalid'],
            IdentityErrorDefinition['authorization-rejected'],
            IdentityErrorDefinition['provider-unavailable'],
            IdentityErrorDefinition['provider-response-invalid'],
            IdentityErrorDefinition['login-unavailable'],
            AccessErrorDefinition['session-unavailable'],
            IdentityErrorDefinition['user-conflict'],
            IdentityErrorDefinition['identity-conflict'],
        ],
        request: { body: OidcLoginCallbackBodySchema },
        responses: [{ status: 201, schema: OidcLoginCallbackResponseSchema }],
    })
    async oidcLoginCallback(
        @Body() dto: OidcLoginCallbackBody,
        @Cookie('talosArk_oidc_transaction') id: string,
        @Res({ passthrough: true }) res: FastifyReply
    ): Promise<OidcLoginCallbackResponse> {
        const data = await this.authService.oidcLoginCallback({ ...dto, id });
        res.clearCookie('talosArk_oidc_transaction');
        if (data.type === 'block') return { type: 'block', data: {} };

        return {
            type: 'success',
            data: toSessionCredentials(data.data),
        };
    }

    @Post('session/refresh')
    @ApiRoute({
        auth: 'public',
        summary: 'Refresh session',
        description: 'Rotate the supplied refresh token without requiring an access token.',
        request: { body: SessionRefreshBodySchema },
        responses: [{ status: 200, schema: SessionRefreshResponseSchema }],
        errors: [
            AccessErrorDefinition['session-inactive'],
            AccessErrorDefinition['refresh-token-reused'],
            AccessErrorDefinition['session-unavailable'],
        ],
    })
    async sessionRefresh(
        @Body() dto: SessionRefreshBody,
        @Res({ passthrough: true }) res: FastifyReply
    ): Promise<SessionRefreshResponse> {
        res.header('Cache-Control', 'no-store');
        return toSessionCredentials(await this.authService.sessionRefresh(dto));
    }

    @Post('session/logout')
    @ApiRoute({
        auth: 'required',
        summary: 'Log out session',
        description: 'Revoke only the session identified by the authenticated access token.',
        responses: [{ status: 204 }],
        errors: [
            AccessErrorDefinition['session-inactive'],
            AccessErrorDefinition['session-unavailable'],
        ],
    })
    async sessionLogout(@Req() request: FastifyRequest): Promise<void> {
        const claim = request.jwtClaim;
        if (!claim) throw new RequestError({ reason: 'authentication' });
        await this.authService.sessionLogout({ sessionId: claim.sid });
    }
}
