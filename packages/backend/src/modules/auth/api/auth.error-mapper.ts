import { AuthErrorContract } from '@talos-ark/contracts/auth';
import { IdentityError } from '@/core/identity/index.js';
import {
    mapError,
    type ErrorDefinition,
    type ErrorMapper,
} from '@/platform/error/error.definition.js';

export const AuthErrorDefinition = {
    transactionInvalid: {
        contract: AuthErrorContract.transactionInvalid,
        message: 'Login transaction is invalid or expired',
        logLevel: 'info',
    },
    authorizationRejected: {
        contract: AuthErrorContract.authorizationRejected,
        message: 'Authorization was rejected',
        logLevel: 'info',
    },
    providerUnavailable: {
        contract: AuthErrorContract.providerUnavailable,
        message: 'Identity provider is unavailable',
        logLevel: 'error',
    },
    providerResponseInvalid: {
        contract: AuthErrorContract.providerResponseInvalid,
        message: 'Identity provider returned an invalid response',
        logLevel: 'error',
    },
    loginUnavailable: {
        contract: AuthErrorContract.loginUnavailable,
        message: 'Login is currently unavailable',
        logLevel: 'error',
    },
    userConflict: {
        contract: AuthErrorContract.userConflict,
        message: 'User identity already exists',
        logLevel: 'info',
    },
    identityConflict: {
        contract: AuthErrorContract.identityConflict,
        message: 'External identity is already linked',
        logLevel: 'info',
    },
} as const satisfies Record<string, ErrorDefinition>;

export const mapAuthError: ErrorMapper = (error) => {
    if (error instanceof IdentityError) {
        const key = {
            'transaction-invalid': 'transactionInvalid',
            'authorization-rejected': 'authorizationRejected',
            'provider-unavailable': 'providerUnavailable',
            'provider-response-invalid': 'providerResponseInvalid',
            'login-unavailable': 'loginUnavailable',
            'user-conflict': 'userConflict',
            'identity-conflict': 'identityConflict',
        } as const;
        return mapError(AuthErrorDefinition[key[error.failure.reason]], null);
    }
};
