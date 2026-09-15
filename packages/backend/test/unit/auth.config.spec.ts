import { authConfig } from '@/config/auth.config.js';

describe('authConfig', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('keeps the refresh-token signing algorithm independent from the access-token algorithm', () => {
        vi.stubEnv('JWT_ACCESS_PRIVATE_KEY', 'access-signing-secret');
        vi.stubEnv('JWT_ACCESS_PUBLIC_KEY', 'access-signing-secret');
        vi.stubEnv('JWT_ACCESS_ALGORITHM', 'HS256');
        vi.stubEnv('JWT_REFRESH_PRIVATE_KEY', 'refresh-signing-secret');
        vi.stubEnv('JWT_REFRESH_PUBLIC_KEY', 'refresh-signing-secret');
        vi.stubEnv('JWT_REFRESH_ALGORITHM', 'HS512');

        const config = authConfig();

        expect(config.accessToken.algorithm).toBe('HS256');
        expect(config.refreshToken.algorithm).toBe('HS512');
    });

    it('rejects the unsigned JWT algorithm', () => {
        vi.stubEnv('JWT_ACCESS_PRIVATE_KEY', 'access-signing-secret');
        vi.stubEnv('JWT_ACCESS_PUBLIC_KEY', 'access-signing-secret');
        vi.stubEnv('JWT_ACCESS_ALGORITHM', 'none');
        vi.stubEnv('JWT_REFRESH_PRIVATE_KEY', 'refresh-signing-secret');
        vi.stubEnv('JWT_REFRESH_PUBLIC_KEY', 'refresh-signing-secret');
        vi.stubEnv('JWT_REFRESH_ALGORITHM', 'HS256');

        expect(() => authConfig()).toThrow();
    });
});
