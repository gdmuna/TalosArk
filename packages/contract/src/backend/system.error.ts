import { defineErrorCatalog, RequestErrorContract } from '../protocol/error.js';

export const SystemErrorDefinition = defineErrorCatalog('system', {
    internal: {
        public: RequestErrorContract.internal,
        protocol: { http: { status: 500 } },
        internal: { logLevel: 'error' },
    },
});
