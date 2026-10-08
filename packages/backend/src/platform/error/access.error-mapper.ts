import { AuthErrorContract } from '@talos-ark/contracts/auth';
import { AccessError } from '@/core/access/access.error.js';
import { mapError, type ErrorDefinition, type ErrorMapper } from './error.definition.js';

export const AccessErrorDefinition = {
    sessionUnavailable: {
        contract: AuthErrorContract.sessionUnavailable,
        message: 'Session service is currently unavailable',
        logLevel: 'error',
    },
    sessionInactive: {
        contract: AuthErrorContract.sessionInactive,
        message: 'Session is inactive or expired',
        logLevel: 'info',
    },
    refreshTokenReused: {
        contract: AuthErrorContract.refreshTokenReused,
        message: 'Refresh token has already been used',
        logLevel: 'warn',
    },
} as const satisfies Record<string, ErrorDefinition>;

export const mapAccessError: ErrorMapper = (error) => {
    if (!(error instanceof AccessError)) return;
    const key = {
        'session-inactive': 'sessionInactive',
        'refresh-token-reused': 'refreshTokenReused',
        'session-unavailable': 'sessionUnavailable',
    } as const;
    return mapError(AccessErrorDefinition[key[error.failure.reason]], null);
};
