import type { Mock, Mocked } from 'vitest';

import {
    CasdoorOidcAdapter,
    type CasdoorOidcSdk,
    type CasdoorOidcTokenIntrospection,
    type CasdoorOidcTokenSet,
    type CasdoorOidcUser,
} from '@/infra/iam/iam-oidc.adapter.js';

import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';

describe('CasdoorOidcAdapter', () => {
    const oidcConfig = {
        endpoint: 'https://casdoor.example.test',
        issuer: 'https://casdoor.example.test',
        clientId: 'talos-ark-client',
        clientSecret: 'client-secret',
        certificate: '',
        redirectUri: 'https://api.example.test/auth/oidc/callback',
    };

    let sdk: Mocked<CasdoorOidcSdk>;
    let configService: { get: Mock };
    let client: CasdoorOidcAdapter;

    beforeEach(() => {
        sdk = {
            getAuthToken: vi.fn(),
            refreshToken: vi.fn(),
            introspect: vi.fn(),
            parseJwtToken: vi.fn(),
            getSignInUrl: vi.fn(),
            getSignUpUrl: vi.fn(),
            getUserProfileUrl: vi.fn(),
            getMyProfileUrl: vi.fn(),
        };
        configService = {
            get: vi.fn().mockReturnValue(oidcConfig),
        };
        client = new CasdoorOidcAdapter(configService as never, sdk);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('builds a standards-compliant authorization URL with state, nonce and PKCE', () => {
        const authorizationUrl = client.createAuthorizationUrl({
            state: 'csrf-state',
            nonce: 'nonce_1',
            codeChallenge: 'pkce_challenge',
        });

        expect(authorizationUrl).not.toBeNull();
        const parsedAuthorizationUrl = new URL(authorizationUrl ?? 'https://invalid.example.test');

        expect(parsedAuthorizationUrl.origin).toBe('https://casdoor.example.test');
        expect(parsedAuthorizationUrl.pathname).toBe('/login/oauth/authorize');
        expect(parsedAuthorizationUrl.searchParams.get('client_id')).toBe('talos-ark-client');
        expect(parsedAuthorizationUrl.searchParams.get('response_type')).toBe('code');
        expect(parsedAuthorizationUrl.searchParams.get('redirect_uri')).toBe(
            'https://api.example.test/auth/oidc/callback'
        );
        expect(parsedAuthorizationUrl.searchParams.get('scope')).toBe('openid profile email');
        expect(parsedAuthorizationUrl.searchParams.get('state')).toBe('csrf-state');
        expect(parsedAuthorizationUrl.searchParams.get('nonce')).toBe('nonce_1');
        expect(parsedAuthorizationUrl.searchParams.get('code_challenge')).toBe('pkce_challenge');
        expect(parsedAuthorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('exchanges the authorization code with the stored PKCE verifier', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    access_token: 'access-token',
                    id_token: 'id-token',
                }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(
            client.exchangeAuthorizationCode({
                code: 'authorization-code',
                codeVerifier: 'pkce-verifier',
            })
        ).resolves.toEqual({ accessToken: 'access-token', idToken: 'id-token' });

        expect(fetchMock).toHaveBeenCalledWith(
            'https://casdoor.example.test/api/login/oauth/access_token',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    client_id: 'talos-ark-client',
                    client_secret: 'client-secret',
                    grant_type: 'authorization_code',
                    code: 'authorization-code',
                    redirect_uri: 'https://api.example.test/auth/oidc/callback',
                    code_verifier: 'pkce-verifier',
                }),
            })
        );
    });

    it('verifies the id token signature, issuer, audience and nonce', () => {
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        configService.get.mockReturnValue({
            ...oidcConfig,
            certificate: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        });
        const idToken = jwt.sign(
            {
                sub: 'casdoor-user-1',
                nonce: 'nonce_1',
                email: 'oidc@example.com',
                preferred_username: 'oidc-user',
            },
            privateKey,
            {
                algorithm: 'RS256',
                issuer: oidcConfig.issuer,
                audience: oidcConfig.clientId,
                expiresIn: '5m',
            }
        );

        expect(client.verifyIdToken(idToken, 'nonce_1')).toEqual({
            issuer: oidcConfig.issuer,
            subject: 'casdoor-user-1',
            email: 'oidc@example.com',
            emailVerified: undefined,
            preferredUsername: 'oidc-user',
        });
        expect(client.verifyIdToken(idToken, 'wrong-nonce')).toBeNull();
    });

    it('delegates Casdoor SDK helper APIs only within Infra', async () => {
        sdk.getSignInUrl.mockReturnValue('https://casdoor.example.test/login/oauth/authorize');
        sdk.getSignUpUrl.mockReturnValue('https://casdoor.example.test/signup/oauth/authorize');
        sdk.getAuthToken.mockResolvedValue({
            access_token: 'legacy-access',
            refresh_token: 'legacy-refresh',
        } satisfies CasdoorOidcTokenSet);
        sdk.refreshToken.mockResolvedValue({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
        } satisfies CasdoorOidcTokenSet);
        sdk.introspect.mockResolvedValue({ active: true } satisfies CasdoorOidcTokenIntrospection);
        const user = {
            owner: 'built-in',
            name: 'alice',
            createdTime: '2026-09-13T00:00:00Z',
        } satisfies CasdoorOidcUser;
        sdk.parseJwtToken.mockReturnValue(user);
        sdk.getUserProfileUrl.mockReturnValue('https://casdoor.example.test/users/built-in/alice');
        sdk.getMyProfileUrl.mockReturnValue('https://casdoor.example.test/account');

        expect(client.getSignInUrl('https://app.example.test/callback')).toContain('/login/');
        expect(
            client.getSignUpAuthorizationUrl('https://app.example.test/callback', 'state_1')
        ).toContain('state=state_1');
        await expect(client.exchangeLegacyAuthorizationCode('code_1')).resolves.toEqual({
            access_token: 'legacy-access',
            refresh_token: 'legacy-refresh',
        });
        await expect(client.refreshAccessToken('legacy-refresh')).resolves.toEqual({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
        });
        await expect(client.introspectAccessToken('access-token')).resolves.toEqual({
            active: true,
        });
        expect(client.parseSignatureVerifiedAccessToken('access-token')).toEqual(user);
        expect(client.getUserProfileUrl('alice')).toContain('/users/built-in/alice');
        expect(client.getMyProfileUrl()).toContain('/account');
    });

    it('returns null for standard OIDC operations when the callback is not configured', async () => {
        configService.get.mockReturnValue(undefined);

        expect(client.isOidcConfigured()).toBe(false);
        expect(
            client.createAuthorizationUrl({
                state: 'state',
                nonce: 'nonce',
                codeChallenge: 'challenge',
            })
        ).toBeNull();
        await expect(
            client.exchangeAuthorizationCode({ code: 'code', codeVerifier: 'verifier' })
        ).resolves.toBeNull();
    });
});
