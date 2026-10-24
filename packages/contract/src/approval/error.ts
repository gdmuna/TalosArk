import { z } from 'zod';
import { defineErrorContract } from '../protocol/error.js';

export const ApprovalErrorContract = {
    forbidden: defineErrorContract(
        'APPROVAL_FORBIDDEN',
        'Request is unavailable or access is denied',
        z.null()
    ),
    invalid: defineErrorContract(
        'APPROVAL_INVALID_INPUT',
        'Approval intent or complete decision is invalid',
        z.null()
    ),
    conflict: defineErrorContract(
        'APPROVAL_CONFLICT',
        'Request changed; reload and retry',
        z.null()
    ),
    state: defineErrorContract(
        'APPROVAL_INVALID_STATE',
        'This approval action is no longer available',
        z.null()
    ),
    binding: defineErrorContract(
        'APPROVAL_BINDING_CHANGED',
        'Current position or governing facility differs from the approved scope',
        z.null()
    ),
    result: defineErrorContract(
        'APPROVAL_RESULT_UNAVAILABLE',
        'Recover the original operation before submitting another write',
        z.null()
    ),
};
