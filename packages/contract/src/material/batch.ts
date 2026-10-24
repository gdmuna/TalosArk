import { z } from 'zod';
import { MaterialParamsSchema } from './material.js';

export const InventoryText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        // eslint-disable-next-line no-control-regex -- Reject control bytes in identifiers.
        .regex(/^[^\u0000-\u001f\u007f-\u009f\ud800-\udfff]*$/u);
export const ExpirySchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('UNKNOWN') }),
    z.strictObject({ kind: z.literal('NONE') }),
    z.strictObject({ kind: z.literal('DATED'), date: z.iso.date() }),
]);
export const MaterialDatesSchema = z.strictObject({
    manufacturedOn: z.iso.date().nullable().default(null),
    expiry: ExpirySchema.default({ kind: 'UNKNOWN' }),
});
export const BatchWriteSchema = MaterialDatesSchema.extend({
    batchNumber: InventoryText(160).min(1),
    notes: z
        .string()
        .max(4000)
        .refine((value) => !value.includes('\0') && !/[\ud800-\udfff]/u.test(value))
        .default(''),
});
export const BatchParamsSchema = MaterialParamsSchema.extend({ batchId: z.uuid().toLowerCase() });
export const BatchUpdateSchema = BatchWriteSchema.extend({
    expectedRevision: z.number().int().positive(),
});
export const BatchArchiveSchema = z.strictObject({
    expectedRevision: z.number().int().positive(),
    archived: z.boolean(),
});
export const BatchQuerySchema = z.strictObject({
    q: InventoryText(160).default(''),
    state: z.enum(['active', 'archived', 'all']).default('active'),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export const BatchSchema = BatchWriteSchema.extend({
    id: z.uuid(),
    resourceId: z.uuid(),
    organizationId: z.uuid(),
    workspaceId: z.uuid(),
    materialId: z.uuid(),
    revision: z.number().int().positive(),
    archivedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});
export const BatchPageSchema = z.object({
    items: z.array(BatchSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    canManage: z.boolean(),
});
export type Expiry = z.infer<typeof ExpirySchema>;
export type BatchWrite = z.infer<typeof BatchWriteSchema>;
export type BatchUpdate = z.infer<typeof BatchUpdateSchema>;
export type BatchArchive = z.infer<typeof BatchArchiveSchema>;
export type BatchQuery = z.infer<typeof BatchQuerySchema>;
export type BatchParams = z.infer<typeof BatchParamsSchema>;
