import { z } from 'zod';
import { WorkspaceContextParamsSchema } from '../team/team.http.js';
import {
    BatchSchema,
    BatchWriteSchema,
    InventoryText,
    MaterialDatesSchema,
} from '../material/batch.js';

const id = z.uuid().toLowerCase();
const revision = z.number().int().positive();
export const InventoryScopeSchema = WorkspaceContextParamsSchema;
export const StockParamsSchema = InventoryScopeSchema.extend({ stockItemId: id });
export const TransactionParamsSchema = InventoryScopeSchema.extend({ transactionId: id });
export const InventoryOrgSchema = z.strictObject({ organizationId: id });
export const OperationParamsSchema = InventoryOrgSchema.extend({ operationId: id });
export const QuantitySchema = z.string().regex(/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/);
export const InstanceFactsSchema = MaterialDatesSchema.extend({
    label: InventoryText(200).default(''),
    notes: z
        .string()
        .max(4000)
        .refine((value) => !value.includes('\0') && !/[\ud800-\udfff]/u.test(value))
        .default(''),
    receivedOn: z.iso.date().nullable().default(null),
    openedAt: z.iso.datetime({ offset: true }).nullable().default(null),
});
export const ReceiptSchema = InstanceFactsSchema.extend({
    materialId: id,
    code: InventoryText(160).min(1).optional(),
    quantity: QuantitySchema,
    batch: z
        .discriminatedUnion('kind', [
            z.strictObject({ kind: z.literal('none') }),
            z.strictObject({ kind: z.literal('existing'), id, expectedRevision: revision }),
            z.strictObject({ kind: z.literal('create'), value: BatchWriteSchema }),
        ])
        .default({ kind: 'none' }),
    position: z.strictObject({ facilityId: id, topologyId: id, nodeId: id }),
    confirmExpired: z.boolean().default(false),
    idempotencyKey: z.string().regex(/^[\x21-\x7e]{1,255}$/),
});
export const InstanceCorrectionSchema = InstanceFactsSchema.extend({
    expectedRevision: revision,
    reason: InventoryText(1000).min(1),
    confirmExpired: z.boolean().default(false),
});
export const InventoryQuerySchema = z.strictObject({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    q: InventoryText(200).default(''),
    materialId: id.optional(),
    batchId: id.optional(),
    nodeId: id.optional(),
    stockItemId: id.optional(),
    operationId: id.optional(),
    status: z.enum(['IN_STOCK', 'CHECKED_OUT', 'QUARANTINED', 'DEPLETED', 'DISPOSED']).optional(),
    expiryRisk: z.enum(['UNKNOWN', 'NONE', 'CURRENT', 'EXPIRED']).optional(),
});
export const InventoryCapabilitiesSchema = z.object({
    read: z.boolean(),
    receive: z.boolean(),
    updateFacts: z.boolean(),
    transfer: z.boolean(),
    manageBatch: z.boolean(),
});
export const InventoryContextSchema = z.object({
    capabilities: InventoryCapabilitiesSchema,
    businessDate: z.iso.date(),
    timeZone: z.string(),
});
export const LocationSchema = z.object({
    facilityId: id,
    topologyId: id,
    nodeId: id,
    path: z.string(),
});
export const StockSchema = InstanceFactsSchema.extend({
    id,
    organizationId: id,
    workspaceId: id,
    resourceId: id,
    instanceId: id,
    instanceResourceId: id,
    code: z.string(),
    initialQuantity: QuantitySchema,
    quantity: QuantitySchema,
    quantityUnit: z.string(),
    quantityScale: z.number().int().min(0).max(6),
    status: z.enum(['IN_STOCK', 'CHECKED_OUT', 'QUARANTINED', 'DEPLETED', 'DISPOSED']),
    version: revision,
    revision,
    createdAt: z.iso.datetime(),
    material: z.object({
        id,
        code: z.string(),
        name: z.string(),
        archivedAt: z.iso.datetime().nullable(),
    }),
    batch: BatchSchema.nullable(),
    expiryRisk: z.enum(['UNKNOWN', 'NONE', 'CURRENT', 'EXPIRED']),
    location: LocationSchema.nullable(),
    locationRestricted: z.boolean(),
    capabilities: InventoryCapabilitiesSchema,
});
export const StockPageSchema = z.object({
    items: z.array(StockSchema),
    total: z.number().int().nonnegative(),
    page: revision,
    pageSize: revision,
});
export const OperationReceiptSchema = z.object({
    operationId: id,
    kind: z.enum(['inventory.receive', 'inventory.relocate']),
    stockItemId: id.nullable(),
    instanceId: id.nullable(),
    nodeId: id.nullable(),
});
export const TransactionLineSchema = z.object({
    stockItemId: id,
    lineNumber: revision,
    unitSnapshot: z.string(),
    quantityBefore: QuantitySchema,
    quantityAfter: QuantitySchema,
    statusBefore: z.string().nullable(),
    statusAfter: z.string(),
    fromNodeId: id.nullable(),
    toNodeId: id.nullable(),
    fromNodePathSnapshot: z.string().nullable(),
    toNodePathSnapshot: z.string().nullable(),
    fromFacilityIdSnapshot: id.nullable(),
    toFacilityIdSnapshot: id.nullable(),
    fromTopologyIdSnapshot: id.nullable(),
    toTopologyIdSnapshot: id.nullable(),
});
export const TransactionSchema = z.object({
    id,
    operationId: id,
    workspaceId: id,
    type: z.string(),
    actorUserId: id,
    occurredAt: z.iso.datetime(),
    reason: z.string().nullable(),
    lines: z.array(TransactionLineSchema),
});
export const TransactionPageSchema = z.object({
    items: z.array(TransactionSchema),
    total: z.number().int().nonnegative(),
    page: revision,
    pageSize: revision,
});
export const RelocationSchema = z.strictObject({
    sourceFacilityId: id,
    sourceTopologyId: id,
    nodeId: id,
    targetFacilityId: id,
    targetTopologyId: id,
    parentId: id.nullable(),
    sourceWorkspaceId: id.optional(),
    targetWorkspaceId: id.optional(),
    code: InventoryText(160).min(1).optional(),
    rowIndex: revision.nullable().optional(),
    columnIndex: revision.nullable().optional(),
});
export const RelocationExecuteSchema = RelocationSchema.extend({
    expectedFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    confirmGovernanceChange: z.literal(true),
    reason: InventoryText(1000).min(1),
    idempotencyKey: z.string().regex(/^[\x21-\x7e]{1,255}$/),
});
export const RelocationPreviewSchema = z.object({
    fingerprint: z.string(),
    nodeCount: z.number().int().nonnegative(),
    itemCount: z.number().int().nonnegative(),
    workspaceIds: z.array(id),
    sourcePath: z.string(),
    targetPath: z.string(),
    sourceManagementWorkspaceId: id,
    targetManagementWorkspaceId: id,
    sourceAccessWorkspaceIds: z.array(id),
    targetAccessWorkspaceIds: z.array(id),
    items: z.array(
        z.object({ stockItemId: id, code: z.string(), workspaceId: id, quantity: QuantitySchema })
    ),
});
export type InventoryScope = z.infer<typeof InventoryScopeSchema>;
export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;
export type InstanceCorrection = z.infer<typeof InstanceCorrectionSchema>;
export type InstanceFacts = z.infer<typeof InstanceFactsSchema>;
export type Relocation = z.infer<typeof RelocationSchema>;
export type RelocationExecute = z.infer<typeof RelocationExecuteSchema>;
export type OperationReceipt = z.infer<typeof OperationReceiptSchema>;
