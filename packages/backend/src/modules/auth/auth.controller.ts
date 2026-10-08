import { type FastifyReply } from 'fastify';
import {
    OidcLoginCallbackBodySchema,
    OidcLoginCallbackResponseSchema,
    OidcStartResponseSchema,
    type OidcLoginCallbackBody,
    type OidcLoginCallbackResponse,
    type OidcStartResponse,
} from '@talos-ark/contracts/auth';
import { AuthService } from './auth.service.js';
import { AuthHttpError } from './api/auth.http-error.js';
import { AccessHttpError } from '@/platform/http/guards/auth.error.js';
import { RequestHttpError } from '@/platform/http/error/http-error.policy.js';

import { Body, Controller, NotImplementedException, Post, Res } from '@nestjs/common';
import { Cookie } from '@/platform/http/decorators/cookie.decorator.js';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('oidc/start')
    @ApiRoute({
        auth: 'public',
        summary: 'Start OIDC login',
        errors: [AuthHttpError.loginUnavailable, AuthHttpError.providerUnavailable],
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
            AuthHttpError.transactionInvalid,
            AuthHttpError.authorizationRejected,
            AuthHttpError.providerUnavailable,
            AuthHttpError.providerResponseInvalid,
            AuthHttpError.loginUnavailable,
            AccessHttpError.sessionUnavailable,
            AuthHttpError.userConflict,
            AuthHttpError.identityConflict,
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

        const { session, tokenPair } = data.data;
        return {
            type: 'success',
            data: {
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
            },
        };
    }

    @Post('session/refresh')
    @ApiRoute({
        auth: 'required',
        summary: 'Refresh session',
        responses: [],
        errors: [RequestHttpError.notImplemented],
    })
    async sessionRefresh(@Cookie('talosArk_session_id') sessionId: string) {
        throw new NotImplementedException('Session refresh is not implemented');
    }

    @Post('session/logout')
    @ApiRoute({
        auth: 'required',
        summary: 'Log out session',
        responses: [],
        errors: [RequestHttpError.notImplemented],
    })
    async sessionLogout(@Cookie('talosArk_session_id') sessionId: string) {
        throw new NotImplementedException('Session logout is not implemented');
    }
}
