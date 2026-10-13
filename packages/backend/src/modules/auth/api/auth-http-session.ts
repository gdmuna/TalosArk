import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AllConfig } from '@/config/index.js';
import type { CreateUserSessionOutput } from '@/core/access/access.contract.js';
import { SessionCredentialsSchema, type SessionCredentials } from '@talos-ark/contracts/auth';
import { RequestError } from '@/platform/request/request.error.js';
import { isAllowedBrowserOrigin } from '@/platform/http/browser-origin.policy.js';

@Injectable()
export class AuthHttpSession {
    constructor(private readonly config: ConfigService<AllConfig, true>) {}

    assertClient(request: FastifyRequest): void {
        const origin = request.headers.origin;
        if (
            request.headers['x-talosark-client'] !== 'browser' ||
            !isAllowedBrowserOrigin(
                origin,
                this.config.get('http.browserOriginPolicy', { infer: true })
            )
        ) {
            throw new RequestError({ reason: 'forbidden' });
        }
    }

    readRefreshToken(request: FastifyRequest): string | undefined {
        const token = request.cookies?.[this.cookieName];
        return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
    }

    deliver(reply: FastifyReply, value: CreateUserSessionOutput): SessionCredentials {
        const payload = SessionCredentialsSchema.parse({
            session: { ...value.session, idleExpiresAt: value.session.idleExpiresAt.toISOString() },
            tokenPair: {
                id: value.tokenPair.id,
                accessToken: {
                    value: value.tokenPair.accessToken.value,
                    expiresAt: value.tokenPair.accessToken.expiresAt.toISOString(),
                },
            },
        });
        reply.header('Cache-Control', 'no-store');
        reply.cookie(this.cookieName, value.tokenPair.refreshToken.value, {
            ...this.cookieOptions,
            maxAge: Math.max(
                0,
                Math.floor(
                    (Math.min(
                        value.tokenPair.refreshToken.expiresAt.getTime(),
                        value.session.idleExpiresAt.getTime()
                    ) -
                        Date.now()) /
                        1000
                )
            ),
        });
        return payload;
    }

    clear(reply: FastifyReply): void {
        reply.header('Cache-Control', 'no-store');
        reply.clearCookie(this.cookieName, this.cookieOptions);
    }

    get cookieOptions() {
        return {
            httpOnly: true,
            secure: this.config.get('auth.cookieSecure', { infer: true }),
            sameSite: 'lax' as const,
            path: '/',
        };
    }

    private get cookieName() {
        return this.cookieOptions.secure ? '__Host-talosark_rt' : 'talosark_rt';
    }
}
