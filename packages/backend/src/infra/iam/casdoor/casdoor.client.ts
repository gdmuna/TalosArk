import { SDK } from 'casdoor-nodejs-sdk';
import { HttpClientFactory } from '@/infra/http/http-client.factory.js';
import type { CasdoorIamOptions } from '../iam.options.js';
import { normalizeIamSdkError } from './casdoor.error.normalize.js';
import { observeIamOperation, observeIamVerification } from '../iam.telemetry.js';

/** Internal supplier helpers, not a DI export or an unrestricted SDK escape hatch. */
export class CasdoorClient {
    private readonly sdk: SDK;

    constructor(options: Readonly<CasdoorIamOptions>, http: HttpClientFactory) {
        this.sdk = new SDK(
            {
                endpoint: options.endpoint,
                clientId: options.clientId,
                clientSecret: options.clientSecret,
                certificate: options.certificate,
                orgName: options.organization,
                appName: options.application,
            },
            {
                timeout: 60_000,
                adapter: http.createAxiosAdapter({
                    name: 'casdoor-sdk',
                    baseUrl: `${options.endpoint}/api`,
                    timeoutMs: 60_000,
                    retry: false,
                }),
            }
        );
    }

    getSignInUrl(redirectUri: string): string {
        return this.sdk.getSignInUrl(redirectUri);
    }

    getSignUpUrl(enablePassword: boolean, redirectUri: string): string {
        return this.sdk.getSignUpUrl(enablePassword, redirectUri);
    }

    getSignUpAuthorizationUrl(redirectUri: string, state: string): string {
        const url = new URL(this.sdk.getSignUpUrl(false, redirectUri));
        url.searchParams.set('state', state);
        return url.toString();
    }

    /** Does not supply PKCE; never used by the application login path. */
    exchangeLegacyAuthorizationCode(code: string) {
        return this.execute('exchange-code', () => this.sdk.getAuthToken(code));
    }

    /** Refreshes supplier credentials, not a TalosArk Session. */
    refreshAccessToken(refreshToken: string, scope?: string) {
        return this.execute('refresh-token', () => this.sdk.refreshToken(refreshToken, scope));
    }

    introspectAccessToken(accessToken: string, tokenTypeHint = 'access_token') {
        return this.execute('introspect-token', () =>
            this.sdk.introspect(accessToken, tokenTypeHint)
        );
    }

    /** Signature-only SDK parsing is not the application identity verification path. */
    parseSignatureVerifiedAccessToken(accessToken: string) {
        return observeIamVerification(
            'verify-signature',
            () => this.sdk.parseJwtToken(accessToken),
            (value) => value !== null && value !== undefined
        );
    }

    getUserProfileUrl(userName: string, accessToken?: string): string {
        return this.sdk.getUserProfileUrl(userName, accessToken);
    }

    getMyProfileUrl(accessToken?: string): string {
        return this.sdk.getMyProfileUrl(accessToken);
    }

    private async execute<T>(
        name: 'exchange-code' | 'refresh-token' | 'introspect-token',
        operation: () => PromiseLike<T>
    ): Promise<T> {
        return observeIamOperation(name, async () => {
            try {
                return await operation();
            } catch (cause) {
                throw normalizeIamSdkError(cause) ?? cause;
            }
        });
    }
}
