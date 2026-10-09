import { AuthErrorContract } from '../auth/error.js';
import { defineErrorCatalog } from '../protocol/error.js';

export const IdentityErrorDefinition = defineErrorCatalog('identity', {
    'transaction-invalid': {
        public: AuthErrorContract.transactionInvalid,
        protocol: { http: { status: 400 } },
        internal: { logLevel: 'info' },
    },
    'authorization-rejected': {
        public: AuthErrorContract.authorizationRejected,
        protocol: { http: { status: 400 } },
        internal: { logLevel: 'info' },
    },
    'provider-unavailable': {
        public: AuthErrorContract.providerUnavailable,
        protocol: { http: { status: 503 } },
        internal: { logLevel: 'error' },
    },
    'provider-response-invalid': {
        public: AuthErrorContract.providerResponseInvalid,
        protocol: { http: { status: 502 } },
        internal: { logLevel: 'error' },
    },
    'login-unavailable': {
        public: AuthErrorContract.loginUnavailable,
        protocol: { http: { status: 503 } },
        internal: { logLevel: 'error' },
    },
    'user-conflict': {
        public: AuthErrorContract.userConflict,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
    'identity-conflict': {
        public: AuthErrorContract.identityConflict,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
});

export const AccessErrorDefinition = defineErrorCatalog('access', {
    'session-unavailable': {
        public: AuthErrorContract.sessionUnavailable,
        protocol: { http: { status: 503 } },
        internal: { logLevel: 'error' },
    },
    'session-inactive': {
        public: AuthErrorContract.sessionInactive,
        protocol: { http: { status: 401 } },
        internal: { logLevel: 'info' },
    },
    'refresh-token-reused': {
        public: AuthErrorContract.refreshTokenReused,
        protocol: { http: { status: 401 } },
        internal: { logLevel: 'warn' },
    },
});
