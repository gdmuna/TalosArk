import { LoginTransactionRepository } from './internal/login-transaction.repository.js';
import { IdentityRepository } from './internal/identity.repository.js';
import { SessionRepository } from './internal/session.repository.js';
import { TokenService } from './internal/token.service.js';
import type {
    AccessTokenClaim,
    AuthenticatedUser,
    BeginOidcLoginResult,
    ChangePasswordCommand,
    CompleteOidcLoginCommand,
    CreateSessionForVerifiedUserCommand,
    IdentitySession,
    PasswordLoginCommand,
    PasswordRegistrationCommand,
    ResetPasswordCommand,
    TokenPair,
} from './identity.types.js';

import { AllConfig } from '@/config/index.js';
import {
    DuplicateUserException,
    InvalidCredentialsException,
    InvalidTokenException,
    OidcLoginFailedException,
    OidcUnavailableException,
} from '@/core/identity/identity.exception.js';
import {
    CasdoorOidcClient,
    type VerifiedOidcIdentity,
} from '@/infra/iam/casdoor/casdoor-oidc.client.js';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

const OIDC_LOGIN_TRANSACTION_TTL_MS = 10 * 60 * 1000;

/**
 * TalosArk 的稳定身份边界。
 *
 * 模块外只通过本类处理本地密码、OIDC 外部身份与 TalosArk 自有会话；Prisma 实体、
 * Casdoor SDK 与会话存储细节均保持在内部。
 */
@Injectable()
export class IdentityKernel {
    constructor(
        private readonly identityRepository: IdentityRepository,
        private readonly loginTransactionRepository: LoginTransactionRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly tokenService: TokenService,
        private readonly casdoorOidcClient: CasdoorOidcClient,
        private readonly configService: ConfigService<AllConfig, true>
    ) {}

    async registerPassword(payload: PasswordRegistrationCommand): Promise<IdentitySession> {
        const username = payload.username.trim().toLowerCase();
        const email = payload.email.trim().toLowerCase();

        if (await this.identityRepository.findDuplicate(username, email)) {
            throw new DuplicateUserException();
        }

        const passwordHash = await bcrypt.hash(
            payload.password,
            this.configService.get('auth.bcryptSaltRound', { infer: true })
        );
        const user = await this.identityRepository.createPasswordAccount({
            username,
            email,
            passwordHash,
        });

        return this.createSession(this.toAuthenticatedUser(user));
    }

    async authenticatePassword(payload: PasswordLoginCommand): Promise<IdentitySession> {
        const user = await this.identityRepository.findByAccount(
            payload.account.trim().toLowerCase()
        );
        if (!user?.passwordHash || !(await bcrypt.compare(payload.password, user.passwordHash))) {
            throw new InvalidCredentialsException();
        }

        return this.createSession(this.toAuthenticatedUser(user));
    }

    /** 由已完成邮箱验证码等可信二次校验的模块调用，建立 TalosArk 自有会话。 */
    async createSessionForVerifiedUser(
        command: CreateSessionForVerifiedUserCommand
    ): Promise<IdentitySession> {
        const user = await this.identityRepository.findById(command.userId);
        if (!user) {
            throw new InvalidTokenException();
        }

        return this.createSession(this.toAuthenticatedUser(user));
    }

    /**
     * 修改本地密码并撤销该用户的全部刷新会话。
     * 返回 false 代表用户不存在或当前密码不匹配，调用方可映射为其领域错误。
     */
    async changePassword(command: ChangePasswordCommand): Promise<boolean> {
        const user = await this.identityRepository.findById(command.userId);
        if (
            !user?.passwordHash ||
            !(await bcrypt.compare(command.currentPassword, user.passwordHash))
        ) {
            return false;
        }

        await this.updatePasswordAndRevokeSessions(command.userId, command.newPassword);
        return true;
    }

    /** 由已完成可信恢复校验的模块调用，重置密码并撤销所有刷新会话。 */
    async resetPassword(command: ResetPasswordCommand): Promise<boolean> {
        const user = await this.identityRepository.findById(command.userId);
        if (!user) return false;

        await this.updatePasswordAndRevokeSessions(command.userId, command.newPassword);
        return true;
    }

    /** 创建短期 state / nonce / PKCE 事务，并返回浏览器应跳转的 Casdoor 授权地址。 */
    async beginOidcLogin(): Promise<BeginOidcLoginResult> {
        const state = createOpaqueValue();
        const nonce = createOpaqueValue();
        const pkceVerifier = createOpaqueValue();
        const authorizationUrl = this.casdoorOidcClient.createAuthorizationUrl({
            state,
            nonce,
            codeChallenge: createPkceChallenge(pkceVerifier),
        });
        if (!authorizationUrl) {
            throw new OidcUnavailableException();
        }

        await this.loginTransactionRepository.create({
            stateHash: hashOpaqueValue(state),
            nonce,
            pkceVerifier,
            expiresAt: new Date(Date.now() + OIDC_LOGIN_TRANSACTION_TTL_MS),
        });

        return { authorizationUrl };
    }

    /**
     * 消费一次 OIDC 登录事务，验证 Casdoor 身份后映射至本地用户并创建 TalosArk 会话。
     * 同一 state 的回调只能成功一次。
     */
    async completeOidcLogin(command: CompleteOidcLoginCommand): Promise<IdentitySession> {
        const transaction = await this.loginTransactionRepository.consume(
            hashOpaqueValue(command.state),
            new Date()
        );
        if (!transaction) {
            throw new OidcLoginFailedException();
        }

        const tokenSet = await this.casdoorOidcClient.exchangeAuthorizationCode({
            code: command.code,
            codeVerifier: transaction.pkceVerifier,
        });
        if (!tokenSet) {
            throw new OidcLoginFailedException();
        }

        const externalIdentity = this.casdoorOidcClient.verifyIdToken(
            tokenSet.idToken,
            transaction.nonce
        );
        if (!externalIdentity) {
            throw new OidcLoginFailedException();
        }

        const user = await this.resolveExternalIdentity(externalIdentity);
        return this.createSession(user);
    }

    /** 原子轮换刷新令牌；旧 token 的重放和并发刷新仅能有一个成功。 */
    async rotateRefreshSession(refreshToken: string): Promise<TokenPair> {
        const refreshClaim = this.tokenService.verifyToken(refreshToken, 'refresh');
        if (!refreshClaim) {
            throw new InvalidTokenException();
        }

        const nextPair = this.tokenService.issueTokenPair({
            userId: refreshClaim.sub,
            sessionId: refreshClaim.sid,
        });
        const rotated = await this.sessionRepository.rotate({
            sessionId: refreshClaim.sid,
            userId: refreshClaim.sub,
            currentRefreshTokenJti: refreshClaim.jti,
            nextRefreshTokenJti: nextPair.refreshTokenJti,
            nextExpiresAt: nextPair.refreshTokenExpiresAt,
            now: new Date(),
        });
        if (!rotated) {
            throw new InvalidTokenException();
        }

        return {
            accessToken: nextPair.accessToken,
            refreshToken: nextPair.refreshToken,
        };
    }

    /** 安全退出：仅撤销与当前刷新 cookie 完全匹配的 TalosArk 会话。 */
    async revokeRefreshSession(refreshToken: string | undefined): Promise<void> {
        if (!refreshToken) return;

        const refreshClaim = this.tokenService.verifyToken(refreshToken, 'refresh');
        if (!refreshClaim) return;

        await this.sessionRepository.revoke({
            sessionId: refreshClaim.sid,
            userId: refreshClaim.sub,
            refreshTokenJti: refreshClaim.jti,
            now: new Date(),
        });
    }

    verifyAccessToken(token: string): AccessTokenClaim | null {
        return this.tokenService.verifyToken(token, 'access');
    }

    private async createSession(user: AuthenticatedUser): Promise<IdentitySession> {
        const sessionId = ulid();
        const tokenPair = this.tokenService.issueTokenPair({ userId: user.id, sessionId });
        await this.sessionRepository.create({
            id: sessionId,
            userId: user.id,
            refreshTokenJti: tokenPair.refreshTokenJti,
            expiresAt: tokenPair.refreshTokenExpiresAt,
        });

        return {
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            user,
        };
    }

    private async updatePasswordAndRevokeSessions(userId: string, password: string): Promise<void> {
        const passwordHash = await bcrypt.hash(
            password,
            this.configService.get('auth.bcryptSaltRound', { infer: true })
        );
        await this.identityRepository.updatePasswordHash(userId, passwordHash);
        await this.sessionRepository.revokeAllForUser(userId, new Date());
    }

    private async resolveExternalIdentity(
        externalIdentity: VerifiedOidcIdentity
    ): Promise<AuthenticatedUser> {
        const linkedIdentity = await this.identityRepository.findByExternalIdentity(
            externalIdentity.issuer,
            externalIdentity.subject
        );
        if (linkedIdentity) {
            return this.toAuthenticatedUser(linkedIdentity.user);
        }

        const email = externalIdentity.email?.trim().toLowerCase();
        if (!email || !email.includes('@') || externalIdentity.emailVerified === false) {
            throw new OidcLoginFailedException();
        }

        // 不以同邮箱自动绑定既有账号，避免外部 IdP 声明变化时造成账户接管。
        if (await this.identityRepository.findByEmail(email)) {
            throw new OidcLoginFailedException();
        }

        try {
            const user = await this.identityRepository.createExternalAccount({
                issuer: externalIdentity.issuer,
                subject: externalIdentity.subject,
                username: createExternalUsername(externalIdentity, email),
                email,
            });
            return this.toAuthenticatedUser(user);
        } catch {
            // 并发回调可能在上一步查询后已完成绑定；此时读取已建立的稳定关系即可。
            const concurrentlyLinked = await this.identityRepository.findByExternalIdentity(
                externalIdentity.issuer,
                externalIdentity.subject
            );
            if (concurrentlyLinked) {
                return this.toAuthenticatedUser(concurrentlyLinked.user);
            }

            throw new OidcLoginFailedException();
        }
    }

    private toAuthenticatedUser(user: {
        id: string;
        username: string;
        email: string;
    }): AuthenticatedUser {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
        };
    }
}

function createOpaqueValue(): string {
    return randomBytes(32).toString('base64url');
}

function hashOpaqueValue(value: string): string {
    return createHash('sha256').update(value).digest('base64url');
}

function createPkceChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

function createExternalUsername(identity: VerifiedOidcIdentity, email: string): string {
    const rawCandidate = identity.preferredUsername ?? email.split('@')[0] ?? 'user';
    const readable =
        rawCandidate
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 23) || 'user';
    const suffix = createHash('sha256')
        .update(`${identity.issuer}:${identity.subject}`)
        .digest('hex')
        .slice(0, 8);

    return `${readable}-${suffix}`;
}
