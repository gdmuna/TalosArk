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
    type SessionRefreshBody,
    type SessionRefreshResponse,
    PasswordLoginBodySchema,
    PasswordLoginResponseSchema,
    AccountActivateBodySchema,
    PasswordSetBodySchema,
    type PasswordLoginBody,
    type PasswordLoginResponse,
    type AccountActivateBody,
    type PasswordSetBody,
} from '@talos-ark/contracts/auth';
import { AuthService } from './auth.service.js';
import {
    IdentityErrorDefinition,
    AccessErrorDefinition,
    AuthErrorDefinition,
} from '@talos-ark/contracts/backend';

import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Cookie } from '@/platform/http/decorators/cookie.decorator.js';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { RequestError } from '@/platform/request/request.error.js';
import { AccessError } from '@/core/access/access.error.js';
import { AuthHttpSession } from './api/auth-http-session.js';
import { AuthAttemptLimiter } from './application/auth-attempt-limiter.js';
import { z } from 'zod';

const localErrors = [
    IdentityErrorDefinition['login-unavailable'],
    AuthErrorDefinition.unavailable,
    AuthErrorDefinition['attempts-limited'],
];
const browserHeaders = z.object({
    origin: z.string().min(1),
    'x-talosark-client': z.literal('browser'),
});

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly httpSession: AuthHttpSession,
        private readonly limiter: AuthAttemptLimiter
    ) {}

    @Post('password/login')
    @ApiRoute({
        auth: 'public',
        summary: 'Sign in with username or email',
        request: { body: PasswordLoginBodySchema, headers: browserHeaders },
        responses: [{ status: 200, schema: PasswordLoginResponseSchema }],
        errors: [
            ...localErrors,
            IdentityErrorDefinition['credentials-invalid'],
            AccessErrorDefinition['session-unavailable'],
        ],
    })
    async passwordLogin(
        @Body() body: PasswordLoginBody,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply
    ): Promise<PasswordLoginResponse> {
        this.httpSession.assertClient(request);
        await this.limiter.check('login', body.identifier.toLowerCase(), request.ip);
        return this.httpSession.deliver(reply, await this.authService.passwordLogin(body));
    }

    @Post('account/activate')
    @ApiRoute({
        auth: 'public',
        summary: 'Activate an operator-provisioned account',
        request: { body: AccountActivateBodySchema, headers: browserHeaders },
        responses: [{ status: 204 }],
        errors: [
            ...localErrors,
            IdentityErrorDefinition['activation-invalid'],
            IdentityErrorDefinition['password-present'],
            IdentityErrorDefinition['password-rejected'],
        ],
    })
    async activateAccount(
        @Body() body: AccountActivateBody,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply
    ): Promise<void> {
        this.httpSession.assertClient(request);
        await this.limiter.check('activate', body.token, request.ip);
        await this.authService.activateAccount(body);
        reply.header('Cache-Control', 'no-store');
    }

    @Post('password/set')
    @ApiRoute({
        auth: 'required',
        summary: 'Set the first local password after a recent OIDC login',
        request: { body: PasswordSetBodySchema, headers: browserHeaders },
        responses: [{ status: 200, schema: PasswordLoginResponseSchema }],
        errors: [
            ...localErrors,
            IdentityErrorDefinition['credentials-invalid'],
            IdentityErrorDefinition['password-present'],
            IdentityErrorDefinition['password-rejected'],
            AuthErrorDefinition['reauthentication-required'],
        ],
    })
    async setFirstPassword(
        @Body() body: PasswordSetBody,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply
    ): Promise<PasswordLoginResponse> {
        this.httpSession.assertClient(request);
        const claim = request.jwtClaim;
        if (!claim) throw new RequestError({ reason: 'authentication' });
        await this.limiter.check('password-set', claim.sub, request.ip);
        return this.httpSession.deliver(
            reply,
            await this.authService.setFirstPassword({
                ...body,
                userId: claim.sub,
                sessionId: claim.sid,
            })
        );
    }

    @Post('oidc/start')
    @ApiRoute({
        auth: 'public',
        summary: 'Start OIDC login',
        request: { headers: browserHeaders },
        errors: [
            IdentityErrorDefinition['login-unavailable'],
            IdentityErrorDefinition['provider-unavailable'],
        ],
        responses: [{ status: 201, schema: OidcStartResponseSchema }],
    })
    async oidcStart(
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) res: FastifyReply
    ): Promise<OidcStartResponse> {
        this.httpSession.assertClient(request);
        const { transactionId, url } = await this.authService.oidcStart();
        res.cookie('talosArk_oidc_transaction', transactionId, {
            ...this.httpSession.cookieOptions,
            maxAge: 10 * 60,
        });
        res.header('Cache-Control', 'no-store');
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
        request: { body: OidcLoginCallbackBodySchema, headers: browserHeaders },
        responses: [{ status: 201, schema: OidcLoginCallbackResponseSchema }],
    })
    async oidcLoginCallback(
        @Body() dto: OidcLoginCallbackBody,
        @Cookie('talosArk_oidc_transaction', { onFailure: 'throw' }) id: string,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) res: FastifyReply
    ): Promise<OidcLoginCallbackResponse> {
        this.httpSession.assertClient(request);
        const data = await this.authService.oidcLoginCallback({ ...dto, id });
        res.clearCookie('talosArk_oidc_transaction', this.httpSession.cookieOptions);
        res.header('Cache-Control', 'no-store');
        if (data.type === 'block') return { type: 'block', data: {} };

        return {
            type: 'success',
            data: this.httpSession.deliver(res, data.data),
        };
    }

    @Post('session/refresh')
    @ApiRoute({
        auth: 'public',
        summary: 'Refresh session',
        security: [{ refreshToken: [] }],
        description:
            'Rotate the HttpOnly refresh cookie without requiring an access token. Requires an allowed Origin and X-TalosArk-Client: browser.',
        request: { body: SessionRefreshBodySchema, headers: browserHeaders },
        responses: [{ status: 200, schema: SessionRefreshResponseSchema }],
        errors: [
            AccessErrorDefinition['session-inactive'],
            AccessErrorDefinition['refresh-token-reused'],
            AccessErrorDefinition['session-unavailable'],
        ],
    })
    async sessionRefresh(
        @Body() _dto: SessionRefreshBody,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) res: FastifyReply
    ): Promise<SessionRefreshResponse> {
        this.httpSession.assertClient(request);
        const refreshToken = this.httpSession.readRefreshToken(request);
        if (!refreshToken) throw new AccessError({ reason: 'session-inactive' });
        return this.httpSession.deliver(
            res,
            await this.authService.sessionRefresh({ refreshToken })
        );
    }

    @Post('session/logout')
    @ApiRoute({
        auth: 'public',
        summary: 'Log out session',
        security: [{ refreshToken: [] }, {}],
        request: { body: SessionRefreshBodySchema, headers: browserHeaders },
        description:
            'Revoke the refresh-cookie session even when its access token expired. Missing or inactive cookies are an idempotent success.',
        responses: [{ status: 204 }],
        errors: [
            AccessErrorDefinition['session-inactive'],
            AccessErrorDefinition['session-unavailable'],
        ],
    })
    async sessionLogout(
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply
    ): Promise<void> {
        this.httpSession.assertClient(request);
        await this.authService.logoutByCookie(this.httpSession.readRefreshToken(request));
        this.httpSession.clear(reply);
    }
}
