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

import { Body, Controller, NotImplementedException, Post, Res } from '@nestjs/common';
import { ApiBody, type SchemaObject } from '@nestjs/swagger';
import { ZodSerializerDto, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import { Cookie } from '@/platform/http/decorators/cookie.decorator.js';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('oidc/start')
    @ApiRoute({
        auth: 'public',
        summary: 'Start OIDC login',
        successStatus: 201,
        responseType: z.toJSONSchema(OidcStartResponseSchema, { target: 'openapi-3.0' }),
    })
    @ZodSerializerDto(OidcStartResponseSchema)
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
        successStatus: 201,
        responseType: z.toJSONSchema(OidcLoginCallbackResponseSchema, {
            target: 'openapi-3.0',
        }),
    })
    @ApiBody({
        // Zod's static return type spans JSON Schema targets, not just OpenAPI 3.0.
        schema: z.toJSONSchema(OidcLoginCallbackBodySchema, {
            target: 'openapi-3.0',
            io: 'input',
        }) as SchemaObject,
    })
    @ZodSerializerDto(OidcLoginCallbackResponseSchema)
    async oidcLoginCallback(
        @Body(new ZodValidationPipe(OidcLoginCallbackBodySchema))
        dto: OidcLoginCallbackBody,
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
    })
    async sessionRefresh(@Cookie('talosArk_session_id') sessionId: string) {
        throw new NotImplementedException('Session refresh is not implemented');
    }

    @Post('session/logout')
    @ApiRoute({
        auth: 'required',
        summary: 'Log out session',
    })
    async sessionLogout(@Cookie('talosArk_session_id') sessionId: string) {
        throw new NotImplementedException('Session logout is not implemented');
    }
}
