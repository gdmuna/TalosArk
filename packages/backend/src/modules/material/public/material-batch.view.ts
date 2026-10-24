import { createHash } from 'node:crypto';
import type { MaterialBatch } from '@root/prisma/generated/client.js';
import { BatchSchema } from '@talos-ark/contracts/material';
import { calendarDate, expiryValue } from './material-dates.js';
export function batchView(row: MaterialBatch) {
    return BatchSchema.parse({
        id: row.id,
        resourceId: row.resourceId,
        organizationId: row.organizationId,
        workspaceId: row.workspaceId,
        materialId: row.materialId,
        batchNumber: row.batchNumber,
        revision: row.revision,
        manufacturedOn: calendarDate(row.manufacturedOn),
        expiry: expiryValue(row),
        notes: row.notes ?? '',
        archivedAt: row.archivedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    });
}
export function batchAuditFacts(row: MaterialBatch) {
    return {
        batchNumber: row.batchNumber,
        manufacturedOn: calendarDate(row.manufacturedOn),
        expiry: expiryValue(row),
        archivedAt: row.archivedAt?.toISOString() ?? null,
        revision: row.revision,
        notesHash: createHash('sha256')
            .update(row.notes ?? '')
            .digest('hex'),
    };
}
