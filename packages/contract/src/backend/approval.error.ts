import { ApprovalErrorContract as c } from '../approval/error.js';
import { defineErrorCatalog } from '../protocol/error.js';

const failure = <T extends (typeof c)[keyof typeof c]>(contract: T, status: number) => ({
    public: contract,
    protocol: { http: { status } },
    internal: { logLevel: 'info' as const },
});
export const ApprovalErrorDefinition = defineErrorCatalog('approval', {
    forbidden: failure(c.forbidden, 403),
    invalid: failure(c.invalid, 400),
    conflict: failure(c.conflict, 409),
    state: failure(c.state, 409),
    binding: failure(c.binding, 409),
    result: failure(c.result, 409),
});
