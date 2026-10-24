import { composeErrorMappers, defineErrorMapper } from '@/platform/error/index.js';
import { DatabaseError } from '@/infra/database/database.error.js';
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
    (failure): IdentityFailure | undefined => {
        if (failure.reason === 'unavailable') return { reason: 'login-unavailable' };
        if (failure.reason !== 'unique-constraint') return undefined;
        const { model, table, fields, constraint } = failure;
        const owner = table ?? model;
        const userConflict =
            ((owner === undefined || owner === 'User') &&
                (constraint === 'User_email_key' || constraint === 'User_username_key')) ||
            (owner === 'User' &&
                fields.length === 1 &&
                fields.some((field) => field === 'email' || field === 'username'));
        if (userConflict) return { reason: 'user-conflict' };
        const identityConflict =
            ((owner === undefined || owner === 'ExternalIdentity') &&
                constraint === 'ExternalIdentity_issuer_subject_key') ||
            (owner === 'ExternalIdentity' &&
                fields.length === 2 &&
                fields.includes('issuer') &&
                fields.includes('subject'));
        if (identityConflict) return { reason: 'identity-conflict' };
        return undefined;
    }
);

export const identityErrors = composeErrorMappers([
    mapIdentityIamError,
    mapIdentityKvsError,
    mapIdentityDatabaseError,
]);
