import { defineErrorMapper } from '@/platform/error/index.js';
import { DatabaseError } from '@/infra/database/database.error.js';
import { SessionError, type SessionFailure } from './session.error.js';

export const mapSessionDatabaseError = defineErrorMapper(
    DatabaseError,
    SessionError,
    (failure, inactiveOnMissing: boolean): SessionFailure | undefined => {
        if (failure.reason === 'unavailable') return { reason: 'session-unavailable' };
        if (inactiveOnMissing && failure.reason === 'record-not-found')
            return { reason: 'session-inactive' };
        return undefined;
    }
);
