import { z } from 'zod';
import { defineErrorContract } from '../protocol/error.js';

export const AuthErrorContract = {
    transactionInvalid: defineErrorContract(
        'AUTH_OIDC_TRANSACTION_INVALID',
        'Login transaction is invalid or expired',
        z.null()
    ),
    authorizationRejected: defineErrorContract(
        'AUTH_AUTHORIZATION_REJECTED',
        'Authorization was rejected',
        z.null()
    ),
    providerUnavailable: defineErrorContract(
        'AUTH_PROVIDER_UNAVAILABLE',
        'Identity provider is unavailable',
        z.null()
    ),
    providerResponseInvalid: defineErrorContract(
        'AUTH_PROVIDER_RESPONSE_INVALID',
        'Identity provider returned an invalid response',
        z.null()
    ),
    loginUnavailable: defineErrorContract(
        'AUTH_LOGIN_UNAVAILABLE',
        'Login is currently unavailable',
        z.null()
    ),
    sessionUnavailable: defineErrorContract(
        'AUTH_SESSION_UNAVAILABLE',
        'Session service is currently unavailable',
        z.null()
    ),
    sessionInactive: defineErrorContract(
        'AUTH_SESSION_INACTIVE',
        'Session is inactive or expired',
        z.null()
    ),
    refreshTokenReused: defineErrorContract(
        'AUTH_REFRESH_TOKEN_REUSED',
        'Refresh token has already been used',
        z.null()
    ),
    userConflict: defineErrorContract(
        'AUTH_USER_CONFLICT',
        'User identity already exists',
        z.null()
    ),
    identityConflict: defineErrorContract(
        'AUTH_IDENTITY_CONFLICT',
        'External identity is already linked',
        z.null()
    ),
} as const;
