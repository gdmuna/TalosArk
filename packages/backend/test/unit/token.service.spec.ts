import { TokenService } from '@/core/identity/internal/token.service.js';

describe('TokenService', () => {
    const tokenConfig = {
        privateKey: 'test-signing-secret',
        publicKey: 'test-signing-secret',
        algorithm: 'HS256' as const,
        expiresIn: '15m',
    };
    const configService = {
        get: vi.fn().mockReturnValue(tokenConfig),
    };
    const tokenService = new TokenService(configService as never);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('issues access and refresh claims with only their stable identity fields', () => {
        const tokens = tokenService.issueTokenPair({
            userId: 'user_123',
            sessionId: 'session_123',
        });

        const accessClaim = tokenService.verifyToken(tokens.accessToken, 'access');
        const refreshClaim = tokenService.verifyToken(tokens.refreshToken, 'refresh');

        expect(accessClaim).toMatchObject({ sub: 'user_123', tokenType: 'access' });
        expect(refreshClaim).toMatchObject({ sub: 'user_123', tokenType: 'refresh' });
        expect(accessClaim).not.toHaveProperty('user');
        expect(accessClaim).not.toHaveProperty('username');
        expect(refreshClaim).not.toHaveProperty('username');
        expect(refreshClaim).toMatchObject({ sid: 'session_123' });
    });

    it('does not accept a refresh token as an access token', () => {
        const { refreshToken } = tokenService.issueTokenPair({
            userId: 'user_123',
            sessionId: 'session_123',
        });

        expect(tokenService.verifyToken(refreshToken, 'access')).toBeNull();
    });
});
