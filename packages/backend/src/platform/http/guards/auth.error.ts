import { AccessErrorDefinition } from '@/platform/error/access.error-mapper.js';
import type { HttpErrorBinding } from '../error/http-error.policy.js';

export const AccessHttpError = {
    sessionUnavailable: { definition: AccessErrorDefinition.sessionUnavailable, status: 503 },
    sessionInactive: { definition: AccessErrorDefinition.sessionInactive, status: 401 },
    refreshTokenReused: { definition: AccessErrorDefinition.refreshTokenReused, status: 401 },
} as const satisfies Record<string, HttpErrorBinding>;
