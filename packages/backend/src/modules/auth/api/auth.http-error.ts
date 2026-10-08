import type { HttpErrorBinding } from '@/platform/http/error/http-error.policy.js';
import { AuthErrorDefinition } from './auth.error-mapper.js';

export const AuthHttpError = {
    transactionInvalid: { definition: AuthErrorDefinition.transactionInvalid, status: 400 },
    authorizationRejected: { definition: AuthErrorDefinition.authorizationRejected, status: 400 },
    providerUnavailable: { definition: AuthErrorDefinition.providerUnavailable, status: 503 },
    providerResponseInvalid: {
        definition: AuthErrorDefinition.providerResponseInvalid,
        status: 502,
    },
    loginUnavailable: { definition: AuthErrorDefinition.loginUnavailable, status: 503 },
    userConflict: { definition: AuthErrorDefinition.userConflict, status: 409 },
    identityConflict: { definition: AuthErrorDefinition.identityConflict, status: 409 },
} as const satisfies Record<string, HttpErrorBinding>;
