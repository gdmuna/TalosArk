import { InventoryErrorContract as c } from '../inventory/error.js';
import { defineErrorCatalog } from '../protocol/error.js';
const failure = <T extends (typeof c)[keyof typeof c]>(contract: T, status: number) => ({
    public: contract,
    protocol: { http: { status } },
    internal: { logLevel: 'info' as const },
});
export const InventoryErrorDefinition = defineErrorCatalog('inventory', {
    forbidden: failure(c.forbidden, 403),
    conflict: failure(c.conflict, 409),
    invalid: failure(c.invalid, 400),
    state: failure(c.state, 409),
    code: failure(c.code, 409),
    expired: failure(c.expired, 409),
    consumptionExpired: failure(c.consumptionExpired, 409),
    insufficient: failure(c.insufficient, 409),
    limit: failure(c.limit, 409),
    result: failure(c.result, 409),
});
