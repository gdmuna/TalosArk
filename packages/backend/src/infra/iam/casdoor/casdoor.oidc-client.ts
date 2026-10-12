import type { HttpClient } from '@/infra/http/type.js';
import { HttpClientFactory } from '@/infra/http/http-client.factory.js';
import type {
    CreateOidcAuthorizationUrlInput,
    ResolveOidcIdentityInput,
    VerifiedExternalIdentity,
} from '../iam.contract.js';
import { resolveIamOptions, type CasdoorIamOptions } from '../iam.options.js';
import { IamError } from '../iam.error.js';
import { normalizeIamHttpError } from './casdoor.error.normalize.js';
import { CasdoorTokenVerifier } from './casdoor.token-verifier.js';

export class CasdoorOidcClient {
    private readonly http: HttpClient;
    private readonly verifier: CasdoorTokenVerifier;
    private readonly options: Readonly<CasdoorIamOptions>;

    constructor(options: CasdoorIamOptions, http: HttpClientFactory) {
        this.options = resolveIamOptions(options);
        this.verifier = new CasdoorTokenVerifier(this.options);
        this.http = http.create({
            name: 'casdoor-oidc',
            baseUrl: `${this.options.endpoint}/api`,
            timeoutMs: 10_000,
            retry: false,
        });
    }

    createAuthorizationUrl(input: CreateOidcAuthorizationUrlInput): string {
        const url = new URL(`${this.options.endpoint}/login/oauth/authorize`);
        url.searchParams.set('client_id', this.options.clientId);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('redirect_uri', this.options.redirectUri);
        url.searchParams.set('scope', 'openid profile email');
        url.searchParams.set('state', input.state);
        url.searchParams.set('nonce', input.nonce);
        url.searchParams.set('code_challenge', input.codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256');
        return url.toString();
    }

    async resolveIdentity(input: ResolveOidcIdentityInput): Promise<VerifiedExternalIdentity> {
        const tokens = await this.exchangeAuthorizationCode(input);
        const verified = this.verifier.verifyIdToken(tokens.idToken, input.expectedNonce);
        if (!this.verifier.verifyAccessToken(tokens.accessToken) || !verified) {
            throw new IamError({ reason: 'invalid-response' });
        }
        const { claims } = verified;
        return {
            issuer: verified.issuer,
            subject: verified.subject,
            profile: {
                username: typeof claims.name === 'string' ? claims.name : undefined,
                email: typeof claims.email === 'string' ? claims.email : undefined,
                nickname:
                    typeof claims.displayName === 'string' || claims.displayName === null
                        ? claims.displayName
                        : undefined,
            },
        };
    }

    private async exchangeAuthorizationCode(
        input: ResolveOidcIdentityInput
    ): Promise<{ accessToken: string; idToken: string }> {
        let response;
        try {
            response = await this.http.request({
                operation: 'oidc.exchange-code',
                method: 'POST',
                path: '/login/oauth/access_token',
                responseType: 'text',
                auth: 'none',
                signal: input.signal,
                retry: false,
                singleflight: false,
                replay: 'never',
                acceptStatus: () => true,
                headers: { accept: 'application/json', 'content-type': 'application/json' },
                body: {
                    client_id: this.options.clientId,
                    client_secret: this.options.clientSecret,
                    grant_type: 'authorization_code',
                    code: input.code,
                    redirect_uri: this.options.redirectUri,
                    code_verifier: input.codeVerifier,
                },
            });
        } catch (cause) {
            throw normalizeIamHttpError(cause) ?? cause;
        }
        if (response.status >= 500 || response.status === 429) {
            throw new IamError({ reason: 'unavailable', upstreamStatus: response.status });
        }
        let result: unknown;
        try {
            result = JSON.parse(String(response.data)) as unknown;
        } catch (cause) {
            if (!(cause instanceof SyntaxError)) throw cause;
            // Do not retain JSON parser messages containing fragments of provider credentials.
            throw new IamError({ reason: 'invalid-response', upstreamStatus: response.status });
        }
        const fields =
            typeof result === 'object' && result !== null && !Array.isArray(result)
                ? (result as Record<string, unknown>)
                : undefined;
        if (fields?.error === 'invalid_grant') {
            throw new IamError({ reason: 'grant-rejected', upstreamStatus: response.status });
        }
        if (fields?.error === 'invalid_client' || fields?.error === 'unauthorized_client') {
            throw new IamError({ reason: 'configuration', upstreamStatus: response.status });
        }
        if (
            response.status < 200 ||
            response.status >= 300 ||
            typeof fields?.access_token !== 'string' ||
            !fields.access_token
        ) {
            throw new IamError({ reason: 'invalid-response', upstreamStatus: response.status });
        }
        // Retain the existing Casdoor fallback; changing it is a separate protocol decision.
        const idToken = typeof fields.id_token === 'string' ? fields.id_token : fields.access_token;
        return { accessToken: fields.access_token, idToken };
    }
}
