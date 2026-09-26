import { CasdoorUser } from './casdoor.client.js';

import { AllConfig } from '@/config/index.js';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

/** 已验签并校验标准声明的 Casdoor JWT；业务侧不应直接依赖额外的 Casdoor 字段。 */
export interface VerifiedIamToken {
    issuer: string;
    subject: string;
    audience: string;
    issuedAt: number;
    expiresAt: number;
    nonce?: string;
    claims: Readonly<CasdoorUser>;
}

/** Casdoor 令牌的本地校验与解码；不会查询 Casdoor 的令牌撤销状态。 */
@Injectable()
export class IamTokenAdapter {
    constructor(private readonly configService: ConfigService<AllConfig, true>) {}

    /** 验签并校验 AT，返回可信声明；不等同于远端 introspection。 */
    verifyAccessToken(accessToken: string): VerifiedIamToken | null {
        return this.verifyToken(accessToken);
    }

    /** 验签并校验 ID Token，同时比对本次 OIDC 请求的 nonce。 */
    verifyIdToken(
        idToken: string,
        options?: {
            expectedNonce?: string;
        }
    ): VerifiedIamToken | null {
        const { expectedNonce } = options ?? {};

        const token = this.verifyToken(idToken);

        if (expectedNonce && (!token?.nonce || token?.nonce !== expectedNonce)) {
            return null;
        }

        return token;
    }

    /** 仅解码 JWT 载荷，不验签、不检查时效；结果绝不可用于认证或授权。 */
    decodeUnverifiedToken(token: string): Readonly<Record<string, unknown>> | null {
        const decoded = jwt.decode(token);
        return isRecord(decoded) ? decoded : null;
    }

    private verifyToken(token: string): VerifiedIamToken | null {
        const config = this.configService.get('casdoor.oidc', { infer: true });
        if (!config) return null;

        try {
            const claims = jwt.verify(token, config.certificate, {
                algorithms: ['RS256'],
                issuer: config.issuer,
                audience: config.clientId,
            }) as CasdoorUser;
            if (!isRecord(claims)) return null;
            if (
                typeof claims.iss !== 'string' ||
                typeof claims.sub !== 'string' ||
                !claims.sub ||
                typeof claims.exp !== 'number' ||
                typeof claims.iat !== 'number' ||
                (claims.azp !== undefined && claims.azp !== config.clientId)
            ) {
                return null;
            }

            // 当前只信任本应用作为 audience；不接受未配置的其他接收方。
            const audience = claims.aud;
            if (
                audience !== config.clientId &&
                (!Array.isArray(audience) ||
                    audience.length !== 1 ||
                    audience[0] !== config.clientId)
            ) {
                return null;
            }

            return {
                issuer: claims.iss,
                subject: claims.sub,
                audience: config.clientId,
                issuedAt: claims.iat,
                expiresAt: claims.exp,
                nonce: typeof claims.nonce === 'string' ? claims.nonce : undefined,
                claims,
            };
        } catch {
            return null;
        }
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
