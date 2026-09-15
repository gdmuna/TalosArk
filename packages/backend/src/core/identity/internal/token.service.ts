import type {
    AccessTokenClaim,
    RefreshTokenClaim,
    TokenPair,
    TokenType,
} from '../identity.types.js';

import { AllConfig } from '@/config/index.js';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import jwt, { SignOptions } from 'jsonwebtoken';
import { ulid } from 'ulid';

/** IdentityKernel 使用的带刷新会话元数据的内部签发结果。 */
export interface IssuedTokenPair extends TokenPair {
    refreshTokenJti: string;
    refreshTokenExpiresAt: Date;
}

@Injectable()
export class TokenService {
    constructor(private readonly configService: ConfigService<AllConfig, true>) {}

    /**
     * 校验并解析 JWT，同时校验 tokenType 是否匹配预期。
     *
     * @param token 需要校验的 JWT。
     * @param expectedTokenType 预期的令牌类型。
     * @returns 校验通过的声明对象；失败时返回 null。
     * @example
     * const claim = authService['verifyToken'](token, 'refresh');
     */
    verifyToken(token: string, expectedTokenType: 'access'): AccessTokenClaim | null;
    verifyToken(token: string, expectedTokenType: 'refresh'): RefreshTokenClaim | null;
    verifyToken(token: string, expectedTokenType: TokenType) {
        try {
            const tokenConfig =
                expectedTokenType === 'access'
                    ? this.configService.get('auth.accessToken', { infer: true })
                    : this.configService.get('auth.refreshToken', { infer: true });
            const decoded = jwt.verify(token, tokenConfig.publicKey, {
                algorithms: [tokenConfig.algorithm],
            });

            if (typeof decoded === 'string') {
                return null;
            }

            // 检查 tokenType 字段是否匹配。
            if (decoded.tokenType !== expectedTokenType) {
                return null;
            }

            if (
                expectedTokenType === 'refresh' &&
                (typeof decoded.sid !== 'string' || decoded.sid.length === 0)
            ) {
                return null;
            }

            return decoded;
        } catch {
            return null;
        }
    }

    /**
     * 生成 Access/Refresh Token 对及其过期信息。
     *
     * @param payload 令牌签发所需的用户 ID。
     * @returns 访问令牌、刷新令牌、刷新令牌过期时间
     * @example
     * const pair = authService['issueTokenPair']({
     *   userId: 'u_1',
     * });
     */
    issueTokenPair(payload: { userId: string; sessionId: string }): IssuedTokenPair {
        const accessToken = this.signToken({
            userId: payload.userId,
            tokenType: 'access',
        });
        const refreshTokenJti = ulid();
        const refreshToken = this.signToken({
            userId: payload.userId,
            tokenType: 'refresh',
            sessionId: payload.sessionId,
            tokenId: refreshTokenJti,
        });

        return {
            accessToken,
            refreshToken,
            refreshTokenJti,
            refreshTokenExpiresAt: this.getTokenExpiry(refreshToken),
        };
    }

    /**
     * 按 token 类型签发 JWT。
     *
     * @param payload 令牌载荷。
     * @returns 签名后的 JWT 字符串。
     * @example
     * const accessToken = authService['signToken']({
     *   userId: 'u_1',
     *   tokenType: 'access',
     * });
     */
    private signToken(payload: {
        userId: string;
        tokenType: TokenType;
        sessionId?: string;
        tokenId?: string;
    }): string {
        const tokenConfig =
            payload.tokenType === 'access'
                ? this.configService.get('auth.accessToken', { infer: true })
                : this.configService.get('auth.refreshToken', { infer: true });

        return jwt.sign(
            {
                sub: payload.userId,
                jti: payload.tokenId ?? ulid(),
                tokenType: payload.tokenType,
                ...(payload.tokenType === 'refresh' && { sid: payload.sessionId }),
            },
            tokenConfig.privateKey,
            {
                algorithm: tokenConfig.algorithm,
                expiresIn: tokenConfig.expiresIn as SignOptions['expiresIn'],
            }
        );
    }

    /** 读取刚签发刷新令牌的 exp，失败意味着内部签发配置不完整。 */
    private getTokenExpiry(token: string): Date {
        const decoded = jwt.decode(token);
        if (typeof decoded === 'string' || !decoded || typeof decoded.exp !== 'number') {
            throw new Error('刷新令牌缺少 exp 声明。');
        }

        return new Date(decoded.exp * 1000);
    }
}
