import { TeamErrorContract } from '../team/error.js';
import { defineErrorCatalog } from '../protocol/error.js';

export const TeamErrorDefinition = defineErrorCatalog('team', {
    forbidden: {
        public: TeamErrorContract.accessDenied,
        protocol: { http: { status: 403 } },
        internal: { logLevel: 'info' },
    },
});
