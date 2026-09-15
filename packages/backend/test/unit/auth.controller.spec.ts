import { AuthController } from '@/modules/auth/auth.controller.js';

import { IdentityKernel } from '@/core/identity/index.js';
import { REFRESH_TOKEN_COOKIE } from '@/config/index.js';

const identityKernel = {
    registerPassword: vi.fn(),
    authenticatePassword: vi.fn(),
    beginOidcLogin: vi.fn(),
    completeOidcLogin: vi.fn(),
    rotateRefreshSession: vi.fn(),
    revokeRefreshSession: vi.fn(),
};

describe('AuthController', () => {
    let controller: AuthController;

    beforeEach(() => {
        vi.clearAllMocks();
        controller = new AuthController(identityKernel as unknown as IdentityKernel);
    });

    it('registers, sets the refresh cookie, and returns the HTTP response', async () => {
        const response: any = { setCookie: vi.fn() };
        identityKernel.registerPassword.mockResolvedValue({
            accessToken: 'at-register',
            refreshToken: 'rt-register',
            user: { id: 'u1', username: 'john', email: 'john@example.com' },
        });

        const result = await controller.register(
            { username: 'john', email: 'john@example.com', password: 'P@ssw0rd!' } as never,
            response
        );

        expect(response.setCookie).toHaveBeenCalledWith(
            REFRESH_TOKEN_COOKIE.NAME,
            'rt-register',
            expect.objectContaining({ httpOnly: true })
        );
        expect(result).toMatchObject({ accessToken: 'at-register', user: { username: 'john' } });
    });

    it('logs in through the identity kernel', async () => {
        const response: any = { setCookie: vi.fn() };
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        identityKernel.authenticatePassword.mockResolvedValue({
            accessToken: 'at-login',
            refreshToken: 'rt-login',
            user: { id: 'u2', username: 'alice', email: 'alice@example.com' },
        });

        try {
            const result = await controller.login(
                { account: 'alice@example.com', password: 'P@ssw0rd!' } as never,
                response
            );

            expect(identityKernel.authenticatePassword).toHaveBeenCalledOnce();
            expect(result).toMatchObject({
                accessToken: 'at-login',
                user: { email: 'alice@example.com' },
            });
            expect(log).not.toHaveBeenCalled();
        } finally {
            log.mockRestore();
        }
    });

    it('rotates the session and sets the new refresh cookie', async () => {
        const response: any = { setCookie: vi.fn() };
        identityKernel.rotateRefreshSession.mockResolvedValue({
            accessToken: 'at-new',
            refreshToken: 'rt-new',
        });

        const result = await controller.refreshToken('rt-old', response);

        expect(identityKernel.rotateRefreshSession).toHaveBeenCalledWith('rt-old');
        expect(response.setCookie).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ accessToken: 'at-new' });
    });

    it('delegates standard OIDC start and callback completion to the identity kernel', async () => {
        const response: any = { setCookie: vi.fn() };
        identityKernel.beginOidcLogin.mockResolvedValue({
            authorizationUrl: 'https://casdoor.example.test/login/oauth/authorize',
        });
        identityKernel.completeOidcLogin.mockResolvedValue({
            accessToken: 'at-oidc',
            refreshToken: 'rt-oidc',
            user: { id: 'u-oidc', username: 'oidc', email: 'oidc@example.com' },
        });

        await expect(controller.beginOidcLogin()).resolves.toEqual({
            authorizationUrl: 'https://casdoor.example.test/login/oauth/authorize',
        });
        await expect(
            controller.completeOidcLogin({ code: 'code_1', state: 'state_1' } as never, response)
        ).resolves.toEqual({
            accessToken: 'at-oidc',
            user: { id: 'u-oidc', username: 'oidc', email: 'oidc@example.com' },
        });
        expect(identityKernel.completeOidcLogin).toHaveBeenCalledWith({
            code: 'code_1',
            state: 'state_1',
        });
        expect(response.setCookie).toHaveBeenCalledWith(
            REFRESH_TOKEN_COOKIE.NAME,
            'rt-oidc',
            expect.objectContaining({ httpOnly: true })
        );
    });

    it('clears the refresh cookie on logout', async () => {
        const response: any = { clearCookie: vi.fn() };
        identityKernel.revokeRefreshSession.mockResolvedValue(undefined);

        await expect(controller.logout('rt-logout', response)).resolves.toBe('ok');
        expect(identityKernel.revokeRefreshSession).toHaveBeenCalledWith('rt-logout');
        expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE.NAME, {
            path: REFRESH_TOKEN_COOKIE.PATH,
        });
    });
});
