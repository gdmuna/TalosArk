import { z } from 'zod';
import { defineErrorContract } from '../protocol/error.js';
export const InventoryErrorContract = {
    forbidden: defineErrorContract(
        'INVENTORY_FORBIDDEN',
        'Inventory is unavailable or access is denied',
        z.null()
    ),
    conflict: defineErrorContract(
        'INVENTORY_CONFLICT',
        'Inventory or request changed; reload and retry',
        z.null()
    ),
    invalid: defineErrorContract(
        'INVENTORY_INVALID_INPUT',
        'Inventory input or quantity is invalid',
        z.null()
    ),
    state: defineErrorContract(
        'INVENTORY_INVALID_STATE',
        'Operation is not allowed in the current state',
        z.null()
    ),
    code: defineErrorContract(
        'INVENTORY_CODE_CONFLICT',
        'Instance code or batch number is already in use',
        z.null()
    ),
    expired: defineErrorContract(
        'INVENTORY_EXPIRY_CONFIRMATION_REQUIRED',
        'Confirm registration of expired stock',
        z.null()
    ),
    limit: defineErrorContract(
        'INVENTORY_LIMIT_EXCEEDED',
        'Relocation exceeds the synchronous operation limit',
        z.null()
    ),
    result: defineErrorContract(
        'INVENTORY_RESULT_UNAVAILABLE',
        'The operation result cannot be replayed; do not repeat with another key',
        z.null()
    ),
};
