import { type FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';

import { Body, Controller, Post, Res } from '@nestjs/common';
import { Cookie } from '@/platform/http/decorators/cookie.decorator.js';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('oidc/start')
    @ApiRoute({
        auth: 'public',
        summary: 'Start OIDC login',
    })
    async oidcStart(@Res({ passthrough: true }) res: FastifyReply) {
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
    })
    async resolveOidcLoginCallback(
        @Body()
        dto: {
            code: string;
            state: string;
        },
        @Cookie('talosArk_oidc_transaction') id: string,
        @Res({ passthrough: true }) res: FastifyReply
    ) {
        const data = await this.authService.oidcLoginCallback({ ...dto, id });
        res.clearCookie('talosArk_oidc_transaction');
        return data;
    }
}
