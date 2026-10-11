import { z } from 'zod';
import {
    defineErrorCatalog,
    defineErrorContract,
    RequestErrorContract,
} from '../protocol/error.js';

export const SystemErrorDefinition = defineErrorCatalog('system', {
    internal: {
        public: RequestErrorContract.internal,
        protocol: { http: { status: 500 } },
        internal: { logLevel: 'error' },
    },
    notReady: {
        public: defineErrorContract('SYS_NOT_READY', 'Process is not ready', z.null()),
        protocol: { http: { status: 503 } },
        internal: { logLevel: 'info' },
    },
});
