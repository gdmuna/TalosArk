import { MaterialErrorContract } from '../material/error.js';
import { defineErrorCatalog } from '../protocol/error.js';

export const MaterialErrorDefinition = defineErrorCatalog('material', {
    'code-conflict': {
        public: MaterialErrorContract.codeConflict,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
    'classification-unavailable': {
        public: MaterialErrorContract.classificationUnavailable,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
    archived: {
        public: MaterialErrorContract.archived,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
    'instance-locked': {
        public: MaterialErrorContract.instanceLocked,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
    conflict: {
        public: MaterialErrorContract.conflict,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
});
