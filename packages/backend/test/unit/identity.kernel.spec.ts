import type { Mocked } from 'vitest';

import {
    DuplicateUserException,
    InvalidTokenException,
    OidcLoginFailedException,
} from '@/core/identity/identity.exception.js';
import { IdentityKernel } from '@/core/identity/identity.kernel.js';
import { IdentityRepository } from '@/core/identity/internal/identity.repository.js';
import { LoginTransactionRepository } from '@/core/identity/internal/login-transaction.repository.js';
import { SessionRepository } from '@/core/identity/internal/session.repository.js';
import { TokenService } from '@/core/identity/internal/token.service.js';
import type { PasswordLoginCommand } from '@/core/identity/index.js';
import { CasdoorOidcClient } from '@/infra/iam/casdoor/casdoor-oidc.client.js';

import bcrypt from 'bcryptjs';

describe('IdentityKernel', () => {
    const passwordHash = bcrypt.hashSync('P@ssw0rd!', 10);

    const identityRepository: Mocked<
        Pick<
            IdentityRepository,
            | 'findDuplicate'
            | 'findByAccount'
            | 'findById'
            | 'findByEmail'
            | 'createPasswordAccount'
            | 'createExternalAccount'
            | 'findByExternalIdentity'
            | 'updatePasswordHash'
        >
    > = {
        findDuplicate: vi.fn(),
        findByAccount: vi.fn(),
        findById: vi.fn(),
        findByEmail: vi.fn(),
        createPasswordAccount: vi.fn(),
        createExternalAccount: vi.fn(),
        findByExternalIdentity: vi.fn(),
        updatePasswordHash: vi.fn(),
    };

    const loginTransactionRepository: Mocked<
        Pick<LoginTransactionRepository, 'create' | 'consume'>
    > = {
        create: vi.fn(),
        consume: vi.fn(),
    };

    const sessionRepository: Mocked<
        Pick<SessionRepository, 'create' | 'rotate' | 'revoke' | 'revokeAllForUser'>
    > = {
        create: vi.fn(),
        rotate: vi.fn(),
        revoke: vi.fn(),
        revokeAllForUser: vi.fn(),
    };

    const tokenService = {
        issueTokenPair: vi.fn(),
        verifyToken: vi.fn(),
    } as unknown as Mocked<Pick<TokenService, 'issueTokenPair' | 'verifyToken'>>;

    const casdoorOidcClient = {
        createAuthorizationUrl: vi.fn(),
        exchangeAuthorizationCode: vi.fn(),
        verifyIdToken: vi.fn(),
    } as unknown as Mocked<
        Pick<
            CasdoorOidcClient,
            'createAuthorizationUrl' | 'exchangeAuthorizationCode' | 'verifyIdToken'
        >
    >;

    const configService = {
        get: vi.fn().mockReturnValue(10),
    };

    let kernel: IdentityKernel;

    beforeEach(() => {
        vi.clearAllMocks();
        tokenService.issueTokenPair.mockReturnValue({
            accessToken: 'at_1',
            refreshToken: 'rt_1',
            refreshTokenJti: 'rtj_1',
            refreshTokenExpiresAt: new Date('2026-10-01T00:00:00.000Z'),
        });
        sessionRepository.create.mockResolvedValue({} as never);
        sessionRepository.rotate.mockResolvedValue(true);
        sessionRepository.revoke.mockResolvedValue({ count: 1 } as never);
        sessionRepository.revokeAllForUser.mockResolvedValue({ count: 1 } as never);
        kernel = new IdentityKernel(
            identityRepository as unknown as IdentityRepository,
            loginTransactionRepository as unknown as LoginTransactionRepository,
            sessionRepository as unknown as SessionRepository,
            tokenService as unknown as TokenService,
            casdoorOidcClient as unknown as CasdoorOidcClient,
            configService as never
        );
    });

    it('authenticates a password and persists a TalosArk-owned refresh session', async () => {
        identityRepository.findByAccount.mockResolvedValue({
            id: 'u_1',
            username: 'john',
            email: 'john@example.com',
            passwordHash,
        } as never);

        const payload: PasswordLoginCommand = {
            account: 'john@example.com',
            password: 'P@ssw0rd!',
        };
        const result = await kernel.authenticatePassword(payload);

        expect(result).toMatchObject({
            accessToken: 'at_1',
            refreshToken: 'rt_1',
            user: { id: 'u_1', username: 'john', email: 'john@example.com' },
        });
        expect(tokenService.issueTokenPair).toHaveBeenCalledWith({
            userId: 'u_1',
            sessionId: expect.any(String),
        });
        expect(sessionRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'u_1',
                refreshTokenJti: 'rtj_1',
            })
        );
    });

    it('registers a local account and returns a safe user projection', async () => {
        identityRepository.findDuplicate.mockResolvedValue(null);
        identityRepository.createPasswordAccount.mockResolvedValue({
            id: 'u_register',
            username: 'new_user',
            email: 'new@example.com',
            passwordHash,
        } as never);

        const result = await kernel.registerPassword({
            username: 'new_user',
            email: 'new@example.com',
            password: 'P@ssw0rd!',
        });

        expect(result.user).toEqual({
            id: 'u_register',
            username: 'new_user',
            email: 'new@example.com',
        });
        expect(result.user).not.toHaveProperty('passwordHash');
        expect(identityRepository.createPasswordAccount).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate local accounts', async () => {
        identityRepository.findDuplicate.mockResolvedValue({ id: 'u_exists' } as never);

        await expect(
            kernel.registerPassword({
                username: 'new_user',
                email: 'new@example.com',
                password: 'P@ssw0rd!',
            })
        ).rejects.toBeInstanceOf(DuplicateUserException);
    });

    it('keeps password hashing and session revocation inside the identity kernel', async () => {
        identityRepository.findById.mockResolvedValue({
            id: 'u_password',
            username: 'password-user',
            email: 'password@example.com',
            passwordHash,
        } as never);
        identityRepository.updatePasswordHash.mockResolvedValue({} as never);

        await expect(
            kernel.changePassword({
                userId: 'u_password',
                currentPassword: 'P@ssw0rd!',
                newPassword: 'N3wP@ssword!',
            })
        ).resolves.toBe(true);

        expect(identityRepository.updatePasswordHash).toHaveBeenCalledWith(
            'u_password',
            expect.any(String)
        );
        expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith(
            'u_password',
            expect.any(Date)
        );
    });

    it('rotates a refresh session through its persisted jti', async () => {
        tokenService.verifyToken.mockReturnValue({
            sub: 'u_4',
            sid: 's_4',
            jti: 'old_jti',
            tokenType: 'refresh',
        } as never);
        tokenService.issueTokenPair.mockReturnValue({
            accessToken: 'at_new',
            refreshToken: 'rt_new',
            refreshTokenJti: 'new_jti',
            refreshTokenExpiresAt: new Date('2026-10-01T00:00:00.000Z'),
        });

        await expect(kernel.rotateRefreshSession('rt_old')).resolves.toEqual({
            accessToken: 'at_new',
            refreshToken: 'rt_new',
        });
        expect(sessionRepository.rotate).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId: 's_4',
                userId: 'u_4',
                currentRefreshTokenJti: 'old_jti',
                nextRefreshTokenJti: 'new_jti',
            })
        );
    });

    it('rejects a replayed refresh session after the conditional rotation loses the race', async () => {
        tokenService.verifyToken.mockReturnValue({
            sub: 'u_4',
            sid: 's_4',
            jti: 'replayed_jti',
            tokenType: 'refresh',
        } as never);
        sessionRepository.rotate.mockResolvedValue(false);

        await expect(kernel.rotateRefreshSession('rt_replayed')).rejects.toBeInstanceOf(
            InvalidTokenException
        );
    });

    it('begins OIDC login with a persisted opaque transaction', async () => {
        casdoorOidcClient.createAuthorizationUrl.mockReturnValue(
            'https://casdoor.example.test/login/oauth/authorize?state=state'
        );
        loginTransactionRepository.create.mockResolvedValue({} as never);

        await expect(kernel.beginOidcLogin()).resolves.toEqual({
            authorizationUrl: 'https://casdoor.example.test/login/oauth/authorize?state=state',
        });
        expect(casdoorOidcClient.createAuthorizationUrl).toHaveBeenCalledWith(
            expect.objectContaining({
                state: expect.any(String),
                nonce: expect.any(String),
                codeChallenge: expect.any(String),
            })
        );
        expect(loginTransactionRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                stateHash: expect.any(String),
                nonce: expect.any(String),
                pkceVerifier: expect.any(String),
                expiresAt: expect.any(Date),
            })
        );
    });

    it('consumes the OIDC transaction before mapping a verified external identity', async () => {
        loginTransactionRepository.consume.mockResolvedValue({
            nonce: 'nonce_1',
            pkceVerifier: 'verifier_1',
        } as never);
        casdoorOidcClient.exchangeAuthorizationCode.mockResolvedValue({
            accessToken: 'external_access',
            idToken: 'external_id',
        });
        casdoorOidcClient.verifyIdToken.mockReturnValue({
            issuer: 'https://casdoor.example.test',
            subject: 'subject_1',
            email: 'oidc@example.com',
            preferredUsername: 'oidc-user',
        });
        identityRepository.findByExternalIdentity.mockResolvedValue({
            user: {
                id: 'u_oidc',
                username: 'oidc-user',
                email: 'oidc@example.com',
            },
        } as never);

        const result = await kernel.completeOidcLogin({ code: 'code_1', state: 'state_1' });

        expect(result.user).toEqual({
            id: 'u_oidc',
            username: 'oidc-user',
            email: 'oidc@example.com',
        });
        expect(casdoorOidcClient.exchangeAuthorizationCode).toHaveBeenCalledWith({
            code: 'code_1',
            codeVerifier: 'verifier_1',
        });
        expect(casdoorOidcClient.verifyIdToken).toHaveBeenCalledWith('external_id', 'nonce_1');
    });

    it('rejects an expired or already-consumed OIDC transaction', async () => {
        loginTransactionRepository.consume.mockResolvedValue(null);

        await expect(
            kernel.completeOidcLogin({ code: 'code_1', state: 'state_1' })
        ).rejects.toBeInstanceOf(OidcLoginFailedException);
    });

    it('does not provision a local account from an explicitly unverified external email', async () => {
        loginTransactionRepository.consume.mockResolvedValue({
            nonce: 'nonce_1',
            pkceVerifier: 'verifier_1',
        } as never);
        casdoorOidcClient.exchangeAuthorizationCode.mockResolvedValue({
            accessToken: 'external_access',
            idToken: 'external_id',
        });
        casdoorOidcClient.verifyIdToken.mockReturnValue({
            issuer: 'https://casdoor.example.test',
            subject: 'subject_1',
            email: 'unverified@example.com',
            emailVerified: false,
        });
        identityRepository.findByExternalIdentity.mockResolvedValue(null);

        await expect(
            kernel.completeOidcLogin({ code: 'code_1', state: 'state_1' })
        ).rejects.toBeInstanceOf(OidcLoginFailedException);
        expect(identityRepository.createExternalAccount).not.toHaveBeenCalled();
    });
});
