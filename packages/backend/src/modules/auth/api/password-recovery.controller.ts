import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
    PasswordRecoveryRequestBodySchema,
    PasswordRecoveryRequestResponseSchema,
    PasswordRecoveryConfirmBodySchema,
    PasswordRecoveryConfirmResponseSchema,
    type PasswordRecoveryRequestBody,
    type PasswordRecoveryRequestResponse,
    type PasswordRecoveryConfirmBody,
    type PasswordRecoveryConfirmResponse,
} from '@talos-ark/contracts/auth';
import {
    AuthErrorDefinition,
    IdentityErrorDefinition,
    AccessErrorDefinition,
} from '@talos-ark/contracts/backend';
import type { AllConfig } from '@/config/index.js';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { AuthHttpSession } from './auth-http-session.js';
import { AuthAttemptLimiter } from '../application/auth-attempt-limiter.js';
import { PasswordRecoveryService } from '../application/password-recovery.service.js';

const browserHeaders = z.object({
    origin: z.string().min(1),
    'x-talosark-client': z.literal('browser'),
});
const commonErrors = [AuthErrorDefinition.unavailable, AuthErrorDefinition['attempts-limited']];

@Controller('auth/password/recovery')
export class PasswordRecoveryController {
    constructor(
        private readonly recovery: PasswordRecoveryService,
        private readonly limiter: AuthAttemptLimiter,
        private readonly httpSession: AuthHttpSession,
        private readonly config: ConfigService<AllConfig, true>
    ) {}

    @Post('request')
    @ApiRoute({
        auth: 'public',
        summary: 'Request password recovery without disclosing account existence',
        request: { body: PasswordRecoveryRequestBodySchema, headers: browserHeaders },
        responses: [{ status: 202, schema: PasswordRecoveryRequestResponseSchema }],
        errors: commonErrors,
    })
    async requestRecovery(
        @Body() body: PasswordRecoveryRequestBody,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply
    ): Promise<PasswordRecoveryRequestResponse> {
        this.httpSession.assertClient(request);
        if (await this.limiter.checkRecoveryRequest(body.email, request.ip))
            this.recovery.enqueue(body.email);
        reply.header('Cache-Control', 'no-store');
        return {
            status: 'accepted',
            retryAfterSeconds: this.config.get('auth.recovery.cooldownSeconds', { infer: true }),
        };
    }

    @Post('confirm')
    @ApiRoute({
        auth: 'public',
        summary: 'Reset a local password and revoke existing sessions',
        request: { body: PasswordRecoveryConfirmBodySchema, headers: browserHeaders },
        responses: [{ status: 200, schema: PasswordRecoveryConfirmResponseSchema }],
        errors: [
            ...commonErrors,
            IdentityErrorDefinition['password-recovery-invalid'],
            IdentityErrorDefinition['password-rejected'],
            IdentityErrorDefinition['login-unavailable'],
            AccessErrorDefinition['session-unavailable'],
        ],
    })
    async confirmRecovery(
        @Body() body: PasswordRecoveryConfirmBody,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply
    ): Promise<PasswordRecoveryConfirmResponse> {
        this.httpSession.assertClient(request);
        await this.limiter.check('recovery-confirm', body.token, request.ip);
        await this.recovery.confirm(body);
        this.httpSession.clear(reply);
        return { status: 'completed' };
    }
}
