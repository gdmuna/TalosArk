import { MaterialErrorContract } from '../material/error.js';
import { defineErrorCatalog } from '../protocol/error.js';

export const MaterialErrorDefinition = defineErrorCatalog('material', {
    forbidden: {
        public: MaterialErrorContract.forbidden,
        protocol: { http: { status: 403 } },
        internal: { logLevel: 'info' },
    },
    invalid: {
        public: MaterialErrorContract.invalid,
        protocol: { http: { status: 400 } },
        internal: { logLevel: 'info' },
    },
    'batch-conflict': {
        public: MaterialErrorContract.batchConflict,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
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
