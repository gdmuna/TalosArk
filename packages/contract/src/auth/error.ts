import { z } from 'zod';
import { defineErrorContract } from '../protocol/error.js';

export const AuthErrorContract = {
    transactionInvalid: defineErrorContract('AUTH_OIDC_TRANSACTION_INVALID', z.null()),
    authorizationRejected: defineErrorContract('AUTH_AUTHORIZATION_REJECTED', z.null()),
    providerUnavailable: defineErrorContract('AUTH_PROVIDER_UNAVAILABLE', z.null()),
    providerResponseInvalid: defineErrorContract('AUTH_PROVIDER_RESPONSE_INVALID', z.null()),
    loginUnavailable: defineErrorContract('AUTH_LOGIN_UNAVAILABLE', z.null()),
    sessionUnavailable: defineErrorContract('AUTH_SESSION_UNAVAILABLE', z.null()),
    sessionInactive: defineErrorContract('AUTH_SESSION_INACTIVE', z.null()),
    refreshTokenReused: defineErrorContract('AUTH_REFRESH_TOKEN_REUSED', z.null()),
    userConflict: defineErrorContract('AUTH_USER_CONFLICT', z.null()),
    identityConflict: defineErrorContract('AUTH_IDENTITY_CONFLICT', z.null()),
} as const;
