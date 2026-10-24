import { DatabaseError } from '@/infra/database/database.error.js';
import { IdempotencyError } from '@/core/idempotency/index.js';
import { MaterialReceiptError } from '@/modules/material/public/index.js';
import { composeErrorMappers, defineErrorMapper } from '@/platform/error/index.js';
import { InventoryError } from './inventory.error.js';
export const inventoryErrors = composeErrorMappers([
    (error) =>
        error instanceof MaterialReceiptError
            ? new InventoryError(
                  { reason: error.reason === 'archived' ? 'state' : 'conflict' },
                  { cause: error }
              )
            : undefined,
    defineErrorMapper(DatabaseError, InventoryError, (f) => {
        if (f.reason === 'transaction-conflict') return { reason: 'conflict' as const };
        if (f.reason !== 'unique-constraint') return undefined;
        if (
            f.constraint === 'MaterialInstance_workspaceId_code_key' ||
            ((f.table ?? f.model) === 'MaterialInstance' && f.fields.includes('code'))
        )
            return { reason: 'code' as const };
        if (
            f.constraint === 'Placement_organizationId_storageNodeId_key' ||
            ((f.table ?? f.model) === 'Placement' && f.fields.includes('storageNodeId'))
        )
            return { reason: 'conflict' as const };
        return undefined;
    }),
    defineErrorMapper(IdempotencyError, InventoryError, (f) => {
        if (['fingerprint-conflict', 'request-in-progress'].includes(f.reason))
            return { reason: 'conflict' as const };
        if (f.reason === 'result-unavailable') return { reason: 'result' as const };
        return undefined;
    }),
]);
