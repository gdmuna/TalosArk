import { CASDOOR_SDK } from './iam.constants.js';
import { IamTokenAdapter } from './iam-token.adapter.js';

import { AllConfig } from '@/config/index.js';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SDK } from 'casdoor-nodejs-sdk';

export type CasdoorOidcSdk = Pick<
    SDK,
    | 'getAuthToken'
    | 'refreshToken'
    | 'introspect'
    | 'parseJwtToken'
    | 'getSignInUrl'
    | 'getSignUpUrl'
    | 'getUserProfileUrl'
    | 'getMyProfileUrl'
>;

export type CasdoorOidcTokenSet = Awaited<ReturnType<SDK['getAuthToken']>>;
export type CasdoorOidcTokenIntrospection = Awaited<ReturnType<SDK['introspect']>>;
export type CasdoorOidcUser = ReturnType<SDK['parseJwtToken']>;

/** 标准 OIDC 授权地址生成所需的调用方安全参数。 */
export interface CreateOidcAuthorizationUrlCommand {
    state: string;
    nonce: string;
    codeChallenge: string;
}

/** 标准授权码交换所需的回调与 PKCE 参数。 */
export interface ExchangeOidcAuthorizationCodeCommand {
    code: string;
    codeVerifier: string;
}

/** 标准授权码交换后，TalosArk 真正需要的令牌字段。 */
export interface OidcTokenSet {
    accessToken: string;
    idToken: string;
}

/** 已通过 Casdoor 签名、issuer、audience 与 nonce 校验的 OIDC 身份。 */
export interface VerifiedOidcIdentity {
    issuer: string;
    subject: string;
    email?: string;
    emailVerified?: boolean;
    preferredUsername?: string;
}

/**
 * Casdoor 平台级 OIDC 适配器。
 *
 * 标准授权码 + PKCE 路径不依赖 Casdoor SDK，因为当前 SDK 的 `getAuthToken()`
 * 不接收 code_verifier。SDK 辅助 API 仍留在本 Infra 适配器中，业务模块不能
 * 透过 Kernel 看到 Casdoor 或 Casbin 类型。
 */
@Injectable()
export class IamOidcAdapter {
    public constructor(
        private readonly configService: ConfigService<AllConfig, true>,
        @Inject(CASDOOR_SDK) private readonly sdk: CasdoorOidcSdk,
        private readonly tokenAdapter: IamTokenAdapter
    ) {}

    /** 判断当前环境是否完整配置了 TalosArk 的标准 OIDC 登录回调。 */
    public isOidcConfigured(): boolean {
        return this.getOidcConfig() !== undefined;
    }

    /**
     * 生成标准 OIDC 授权码登录地址，携带 CSRF state、nonce 与 S256 PKCE challenge。
     * 未配置平台 OIDC 时返回 null，由 IdentityKernel 映射为领域错误。
     */
    public createAuthorizationUrl(command: CreateOidcAuthorizationUrlCommand): string | null {
        const config = this.getOidcConfig();
        if (!config) return null;

        const authorizationUrl = new URL(`${config.endpoint}/login/oauth/authorize`);
        authorizationUrl.searchParams.set('client_id', config.clientId);
        authorizationUrl.searchParams.set('response_type', 'code');
        authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
        authorizationUrl.searchParams.set('scope', 'openid profile email');
        authorizationUrl.searchParams.set('state', command.state);
        authorizationUrl.searchParams.set('nonce', command.nonce);
        authorizationUrl.searchParams.set('code_challenge', command.codeChallenge);
        authorizationUrl.searchParams.set('code_challenge_method', 'S256');

        return authorizationUrl.toString();
    }

    /**
     * 使用授权码和 PKCE verifier 向 Casdoor 交换 OIDC 令牌。
     * 网络、协议或令牌响应失败均返回 null，避免底层 HTTP 细节越过 Infra 边界。
     */
    public async exchangeAuthorizationCode(
        command: ExchangeOidcAuthorizationCodeCommand
    ): Promise<OidcTokenSet | null> {
        const config = this.getOidcConfig();
        if (!config) return null;

        try {
            const response = await fetch(`${config.endpoint}/api/login/oauth/access_token`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    grant_type: 'authorization_code',
                    code: command.code,
                    redirect_uri: config.redirectUri,
                    code_verifier: command.codeVerifier,
                }),
            });
            if (!response.ok) return null;

            const result = await response.json();
            if (!isRecord(result) || typeof result.access_token !== 'string') {
                return null;
            }

            const idToken =
                typeof result.id_token === 'string' ? result.id_token : result.access_token;

            return {
                accessToken: result.access_token,
                idToken,
            };
        } catch {
            return null;
        }
    }

    /**
     * 验证 Casdoor 令牌的签名、标准时间声明、issuer、audience 与本次 OIDC nonce。
     * 失败返回 null；身份与本地用户的绑定由 IdentityKernel 决定。
     */
    // public verifyIdToken(idToken: string, expectedNonce: string): VerifiedOidcIdentity | null {
    //     const token = this.tokenAdapter.verifyIdToken(idToken, expectedNonce);
    //     if (!token) return null;

    //     const claims = token.claims;
    //     return {
    //         issuer: token.issuer,
    //         subject: token.subject,
    //         email: asNonEmptyString(claims.email),
    //         emailVerified:
    //             typeof claims.email_verified === 'boolean' ? claims.email_verified : undefined,
    //         preferredUsername:
    //             asNonEmptyString(claims.preferred_username) ?? asNonEmptyString(claims.name),
    //     };
    // }

    /** 使用 Casdoor SDK 的固定 appName state 生成登录 URL。 */
    public getSignInUrl(redirectUri: string): string {
        return this.requireSdk().getSignInUrl(redirectUri);
    }

    /**
     * 使用 Casdoor SDK 生成注册 URL。
     *
     * 启用密码注册时，Casdoor SDK 会跳转到其本地密码注册页，且不使用
     * `redirectUri` 或调用方 state；需要 OAuth 注册授权时请使用
     * `getSignUpAuthorizationUrl()`。
     */
    public getSignUpUrl(enablePassword: boolean, redirectUri: string): string {
        return this.requireSdk().getSignUpUrl(enablePassword, redirectUri);
    }

    /** 生成携带调用方 state 的 OAuth 注册授权 URL。 */
    public getSignUpAuthorizationUrl(redirectUri: string, state: string): string {
        const authorizationUrl = new URL(this.requireSdk().getSignUpUrl(false, redirectUri));
        authorizationUrl.searchParams.set('state', state);

        return authorizationUrl.toString();
    }

    /** 使用 Casdoor SDK 的旧接口交换授权码；不应用于 TalosArk 的 PKCE 登录链。 */
    public exchangeLegacyAuthorizationCode(code: string): Promise<CasdoorOidcTokenSet> {
        return this.requireSdk().getAuthToken(code);
    }

    /** 使用 Casdoor SDK 刷新 Casdoor 自身的 token 对。 */
    public refreshAccessToken(refreshToken: string, scope?: string): Promise<CasdoorOidcTokenSet> {
        return this.requireSdk().refreshToken(refreshToken, scope);
    }

    /** 使用 Casdoor 的 OAuth introspection 端点检查 access token 状态。 */
    public introspectAccessToken(
        accessToken: string,
        tokenTypeHint = 'access_token'
    ): Promise<CasdoorOidcTokenIntrospection> {
        return this.requireSdk().introspect(accessToken, tokenTypeHint);
    }

    /** 使用 Casdoor SDK 验签并解析令牌；不替代标准 OIDC 的 issuer/audience/nonce 校验。 */
    public parseSignatureVerifiedAccessToken(accessToken: string): CasdoorOidcUser {
        return this.requireSdk().parseJwtToken(accessToken);
    }

    /** 生成指定 Casdoor 用户的资料页 URL。 */
    public getUserProfileUrl(userName: string, accessToken?: string): string {
        return this.requireSdk().getUserProfileUrl(userName, accessToken);
    }

    /** 生成当前 Casdoor 用户的资料页 URL。 */
    public getMyProfileUrl(accessToken?: string): string {
        return this.requireSdk().getMyProfileUrl(accessToken);
    }

    private getOidcConfig() {
        return this.configService.get('casdoor.oidc', { infer: true });
    }

    private requireSdk(): CasdoorOidcSdk {
        if (!this.sdk) {
            throw new Error('Casdoor SDK 未配置，无法调用 Casdoor 管理 API。');
        }

        return this.sdk;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function asNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
