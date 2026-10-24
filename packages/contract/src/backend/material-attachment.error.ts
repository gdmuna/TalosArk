import { MaterialAttachmentErrorContract as c } from '../material/attachment.error.js';
import { defineErrorCatalog } from '../protocol/error.js';

const failure = <T extends (typeof c)[keyof typeof c]>(contract: T, status: number) => ({
    public: contract,
    protocol: { http: { status } },
    internal: { logLevel: 'info' as const },
});

export const MaterialAttachmentErrorDefinition = defineErrorCatalog('material-attachment', {
    invalid: failure(c.invalid, 400),
    unavailable: failure(c.unavailable, 404),
    'storage-unavailable': {
        public: c.storageUnavailable,
        protocol: { http: { status: 503 } },
        internal: { logLevel: 'error' as const },
    },
    conflict: failure(c.conflict, 409),
    expired: failure(c.expired, 409),
    busy: failure(c.busy, 409),
    'not-ready': failure(c.notReady, 409),
    format: failure(c.format, 400),
    size: failure(c.size, 400),
    integrity: failure(c.integrity, 400),
    readonly: failure(c.readonly, 409),
    'in-use': failure(c.inUse, 409),
});
