import { FacilityErrorContract } from '../facility/error.js';
import { defineErrorCatalog } from '../protocol/error.js';

const failure = <
    Contract extends (typeof FacilityErrorContract)[keyof typeof FacilityErrorContract],
>(
    contract: Contract,
    status: number
) => ({
    public: contract,
    protocol: { http: { status } },
    internal: { logLevel: 'info' as const },
});
export const FacilityErrorDefinition = defineErrorCatalog('facility', {
    forbidden: failure(FacilityErrorContract.forbidden, 403),
    conflict: failure(FacilityErrorContract.conflict, 409),
    'code-conflict': failure(FacilityErrorContract.codeConflict, 409),
    'invalid-input': failure(FacilityErrorContract.invalidInput, 400),
    'invalid-cursor': failure(FacilityErrorContract.invalidCursor, 400),
    occupied: failure(FacilityErrorContract.occupied, 409),
    'invalid-state': failure(FacilityErrorContract.invalidState, 409),
});
