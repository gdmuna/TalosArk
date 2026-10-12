import { defineErrorMapper } from '@/platform/error/index.js';
import { DatabaseError } from '@/infra/database/database.error.js';
import { AccessError, type AccessFailure } from './access.error.js';

export const mapAccessDatabaseError = defineErrorMapper(
    DatabaseError,
    AccessError,
    (failure, inactiveOnMissing: boolean): AccessFailure | undefined => {
        if (failure.reason === 'unavailable') return { reason: 'session-unavailable' };
        if (inactiveOnMissing && failure.reason === 'record-not-found')
            return { reason: 'session-inactive' };
        return undefined;
    }
);
