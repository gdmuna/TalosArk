import { z } from 'zod';
import { defineErrorContract } from '../protocol/error.js';

export const FacilityErrorContract = {
    forbidden: defineErrorContract(
        'FACILITY_FORBIDDEN',
        'Facility is unavailable or access is denied',
        z.null()
    ),
    conflict: defineErrorContract(
        'FACILITY_CONFLICT',
        'The facility or layout changed; reload and retry',
        z.null()
    ),
    codeConflict: defineErrorContract(
        'FACILITY_CODE_CONFLICT',
        'Code or coordinate is already in use',
        z.null()
    ),
    invalidInput: defineErrorContract(
        'FACILITY_INVALID_INPUT',
        'Storage structure is invalid',
        z.null()
    ),
    invalidCursor: defineErrorContract(
        'FACILITY_INVALID_CURSOR',
        'Storage query cursor is invalid',
        z.null()
    ),
    occupied: defineErrorContract(
        'FACILITY_OCCUPIED',
        'Remove stored items before changing this structure',
        z.null()
    ),
    invalidState: defineErrorContract(
        'FACILITY_INVALID_STATE',
        'Operation is not allowed in the current state',
        z.null()
    ),
};
