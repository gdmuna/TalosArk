import {
    AccessTokenDto,
    AuthResponseDto,
    LoginDto,
    OidcAuthorizationUrlDto,
    OidcCallbackDto,
    RegisterDto,
} from './auth.dto.js';

import AUTH_EXCEPTION from '@/core/identity/identity.exception.js';
import { IdentityKernel } from '@/core/identity/index.js';
import { ApiRoute, Cookie } from '@/platform/http/decorators/index.js';

import { REFRESH_TOKEN_COOKIE } from '@/config/auth.config.js';

import { Controller, Post, Body, Res, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

@ApiTags('认证模块')
@Controller('auth')
export class AuthController {
    constructor(private readonly identityKernel: IdentityKernel) {}

    @Post('register')
    @ApiRoute({
        auth: 'public',
        summary: '用户注册',
        description: '创建一个新用户账户，并返回访问令牌和用户信息。',
        responseType: AuthResponseDto,
        errors: [AUTH_EXCEPTION.DuplicateUserException.code],
    })
    async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: FastifyReply) {
        const authResult = await this.identityKernel.registerPassword(body);

        this.setRefreshTokenCookie(response, authResult.refreshToken);

        return {
            accessToken: authResult.accessToken,
            user: authResult.user,
        };
    }

    @Post('login')
    @ApiRoute({
        auth: 'public',
        summary: '用户登录',
        description: '验证用户凭据，成功后返回访问令牌和用户信息。',
        responseType: AuthResponseDto,
        errors: [AUTH_EXCEPTION.InvalidCredentialsException.code],
    })
    async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: FastifyReply) {
        const authResult = await this.identityKernel.authenticatePassword(body);

        this.setRefreshTokenCookie(response, authResult.refreshToken);

        return {
            accessToken: authResult.accessToken,
            user: authResult.user,
        };
    }

    @Get('oidc/login')
    @ApiRoute({
        auth: 'public',
        summary: '发起平台级第三方登录',
        description: '创建一次性 OIDC state、nonce 与 PKCE 登录事务，并返回 Casdoor 授权地址。',
        responseType: OidcAuthorizationUrlDto,
        errors: [AUTH_EXCEPTION.OidcUnavailableException.code],
    })
    async beginOidcLogin() {
        return this.identityKernel.beginOidcLogin();
    }

    @Get('oidc/callback')
    @ApiRoute({
        auth: 'public',
        summary: '完成平台级第三方登录',
        description: '消费 OIDC 授权码回调，验证外部身份并建立 TalosArk 自有会话。',
        responseType: AuthResponseDto,
        errors: [AUTH_EXCEPTION.OidcLoginFailedException.code],
    })
    async completeOidcLogin(
        @Query() query: OidcCallbackDto,
        @Res({ passthrough: true }) response: FastifyReply
    ) {
        const authResult = await this.identityKernel.completeOidcLogin(query);

        this.setRefreshTokenCookie(response, authResult.refreshToken);
        return {
            accessToken: authResult.accessToken,
            user: authResult.user,
        };
    }

    @Post('refresh-token')
    @ApiRoute({
        auth: 'public',
        summary: '刷新访问令牌',
        description: '使用有效的刷新令牌获取新的访问令牌。',
        responseType: AccessTokenDto,
    })
    async refreshToken(
        @Cookie('refresh_token') refreshToken: string,
        @Res({ passthrough: true }) response: FastifyReply
    ) {
        const tokenPair = await this.identityKernel.rotateRefreshSession(refreshToken);
        this.setRefreshTokenCookie(response, tokenPair.refreshToken);

        return {
            accessToken: tokenPair.accessToken,
        };
    }

    @Get('clear-cookie')
    @ApiRoute({
        auth: 'optional',
        summary: '清除刷新令牌 Cookie',
        description: '清除浏览器中的刷新令牌 Cookie，通常用于用户登出。',
        responseType: { type: 'string', example: 'ok' },
    })
    async logout(
        @Cookie('refresh_token') refreshToken: string | undefined,
        @Res({ passthrough: true }) response: FastifyReply
    ) {
        await this.identityKernel.revokeRefreshSession(refreshToken);
        response.clearCookie(REFRESH_TOKEN_COOKIE.NAME, {
            path: REFRESH_TOKEN_COOKIE.PATH,
        });
        return 'ok';
    }

    private setRefreshTokenCookie(response: FastifyReply, refreshToken: string): void {
        response.setCookie(REFRESH_TOKEN_COOKIE.NAME, refreshToken, {
            httpOnly: REFRESH_TOKEN_COOKIE.HTTP_ONLY,
            sameSite: REFRESH_TOKEN_COOKIE.SAME_SITE,
            secure: REFRESH_TOKEN_COOKIE.SECURE,
            path: REFRESH_TOKEN_COOKIE.PATH,
            maxAge: Math.floor(REFRESH_TOKEN_COOKIE.MAX_AGE_MS / 1000),
        });
    }
}
