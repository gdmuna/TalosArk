import { TeamErrorContract } from '../team/error.js';
import { defineErrorCatalog } from '../protocol/error.js';

export const TeamErrorDefinition = defineErrorCatalog('team', {
    forbidden: {
        public: TeamErrorContract.accessDenied,
        protocol: { http: { status: 403 } },
        internal: { logLevel: 'info' },
    },
    conflict: {
        public: TeamErrorContract.conflict,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
    'invitation-invalid': {
        public: TeamErrorContract.invitationInvalid,
        protocol: { http: { status: 400 } },
        internal: { logLevel: 'info' },
    },
    'account-unavailable': {
        public: TeamErrorContract.accountUnavailable,
        protocol: { http: { status: 400 } },
        internal: { logLevel: 'info' },
    },
    unavailable: { public: TeamErrorContract.unavailable, protocol: { http: { status: 503 } } },
});
