import { z } from 'zod';
import { defineErrorContract } from '../protocol/error.js';

export const MaterialErrorContract = {
    forbidden: defineErrorContract(
        'MATERIAL_FORBIDDEN',
        'Material or batch is unavailable or access is denied',
        z.null()
    ),
    invalid: defineErrorContract(
        'MATERIAL_INVALID_INPUT',
        'Material dates or batch input is invalid',
        z.null()
    ),
    batchConflict: defineErrorContract(
        'MATERIAL_BATCH_CONFLICT',
        'Batch number is already in use for this material',
        z.null()
    ),
    codeConflict: defineErrorContract(
        'MATERIAL_CODE_CONFLICT',
        'The code is already used in this workspace',
        z.null()
    ),
    classificationUnavailable: defineErrorContract(
        'MATERIAL_CLASSIFICATION_UNAVAILABLE',
        'An active classification in the same workspace is required',
        z.null()
    ),
    archived: defineErrorContract(
        'MATERIAL_ARCHIVED',
        'Restore the material before editing it',
        z.null()
    ),
    instanceLocked: defineErrorContract(
        'MATERIAL_INSTANCE_LOCKED',
        'Unit and branch cannot change after an instance exists',
        z.null()
    ),
    conflict: defineErrorContract(
        'MATERIAL_CONFLICT',
        'The material changed concurrently; reload before retrying',
        z.null()
    ),
};
