import { defineErrorMapper } from '@/platform/error/index.js';
import { DatabaseError } from '@/infra/database/prisma/prisma.error.js';
import { IamError } from '@/infra/iam/iam.error.js';
import { KvsError } from '@/infra/kvs/kvs.error.js';
import { IdentityError, type IdentityFailure } from './identity.error.js';

export const mapIdentityIamError = defineErrorMapper(
    IamError,
    IdentityError,
    (failure): IdentityFailure => {
        const reasons = {
            'grant-rejected': 'authorization-rejected',
            unavailable: 'provider-unavailable',
            'invalid-response': 'provider-response-invalid',
            'not-configured': 'login-unavailable',
            configuration: 'login-unavailable',
            'request-failed': 'provider-response-invalid',
        } as const;
        return { reason: reasons[failure.reason] };
    }
);

export const mapIdentityKvsError = defineErrorMapper(
    KvsError,
    IdentityError,
    (failure): IdentityFailure | undefined =>
        failure.reason === 'unavailable' ? { reason: 'login-unavailable' } : undefined
);

export const mapIdentityDatabaseError = defineErrorMapper(
    DatabaseError,
    IdentityError,
    (failure, conflict?: 'user' | 'identity'): IdentityFailure | undefined => {
        if (failure.reason === 'unavailable') return { reason: 'login-unavailable' };
        if (failure.reason !== 'unique-constraint') return undefined;
        const { model, fields, constraint } = failure;
        const userConflict =
            constraint === 'User_email_key' ||
            constraint === 'User_username_key' ||
            (model === 'User' &&
                fields.length === 1 &&
                fields.some((field) => field === 'email' || field === 'username'));
        if (conflict === 'user' && userConflict) return { reason: 'user-conflict' };
        const identityConflict =
            constraint === 'ExternalIdentity_issuer_subject_key' ||
            (model === 'ExternalIdentity' &&
                fields.length === 2 &&
                fields.includes('issuer') &&
                fields.includes('subject'));
        if (conflict && identityConflict) return { reason: 'identity-conflict' };
        return undefined;
    }
);
