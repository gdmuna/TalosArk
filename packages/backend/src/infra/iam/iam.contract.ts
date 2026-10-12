export interface CreateOidcAuthorizationUrlInput {
    state: string;
    nonce: string;
    codeChallenge: string;
}

export interface ResolveOidcIdentityInput {
    code: string;
    codeVerifier: string;
    expectedNonce: string;
    signal?: AbortSignal;
}

export interface ExternalIdentityProfile {
    username?: string;
    email?: string;
    nickname?: string | null;
}

/** Provider-verified identity; profile fields are not authorization grants. */
export interface VerifiedExternalIdentity {
    issuer: string;
    subject: string;
    profile: ExternalIdentityProfile;
}
