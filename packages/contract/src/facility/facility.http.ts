import { z } from 'zod';
import { BusinessCodeInputSchema } from '../protocol/scalar.js';

const id = z.uuid().toLowerCase();
const text = z
    .string()
    .trim()
    .min(1)
    .max(160)
    .refine((value) => !/[\uD800-\uDFFF]/u.test(value), 'Text must be well-formed Unicode')
    // eslint-disable-next-line no-control-regex -- Names and codes must remain safe resource labels.
    .regex(/^[^\u0000-\u001f\u007f-\u009f]+$/u);
const revision = z.number().int().positive().max(2_147_483_647);
const timestamp = z.iso.datetime().nullable();
const coordinate = z.number().int().min(1).max(10000).nullable();
export const FacilityScopeSchema = z.strictObject({ organizationId: id });
export const FacilityParamsSchema = FacilityScopeSchema.extend({ facilityId: id });
export const StorageParamsSchema = FacilityParamsSchema.extend({ topologyId: id });
export const StorageNodeParamsSchema = StorageParamsSchema.extend({ nodeId: id });
export const FacilityReadQuerySchema = z.strictObject({ workspaceId: id.optional() });
export const FacilityGovernanceSchema = z.strictObject({
    canCreate: z.boolean(),
    canGovern: z.boolean(),
    canInitialize: z.boolean(),
});
export const FacilityInitializeSchema = z.strictObject({ updated: z.boolean() });
export const FacilityQuerySchema = FacilityReadQuerySchema.extend({
    q: z.string().trim().max(160).default(''),
    state: z.enum(['active', 'archived', 'all']).default('active'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const FacilityWriteSchema = z.strictObject({
    code: BusinessCodeInputSchema(160),
    name: text,
    description: z.string().trim().max(2000).nullable().default(null),
    location: z.string().trim().max(500).nullable().default(null),
    managementWorkspaceId: id,
});
export const FacilityUpdateSchema = FacilityWriteSchema.extend({ expectedRevision: revision });
export const FacilityStateSchema = z.strictObject({
    expectedRevision: revision,
    state: z.enum(['active', 'disabled', 'archived']),
});
export const FacilityGrantSchema = z.strictObject({
    expectedRevision: revision,
    workspaceId: id,
    level: z.enum(['USE', 'MANAGE']).nullable(),
});
export const StorageContainerTypeSchema = z.enum([
    'FREEZER',
    'LIQUID_NITROGEN_TANK',
    'CABINET',
    'SHELF',
    'RACK',
    'DRAWER',
    'BOX',
    'PARTITION',
    'OTHER',
]);
const nodeFields = {
    code: BusinessCodeInputSchema(160),
    name: text,
    description: z.string().trim().max(2000).nullable().default(null),
    containerType: StorageContainerTypeSchema.nullable().default(null),
    rowIndex: coordinate.default(null),
    columnIndex: coordinate.default(null),
    rowCount: coordinate.default(null),
    columnCount: coordinate.default(null),
};
export const StorageNodeCreateSchema = z.strictObject({
    ...nodeFields,
    kind: z.enum(['CONTAINER', 'POSITION']),
    parentId: id.nullable(),
    workspaceId: id.optional(),
    expectedRevision: revision,
});
export const StorageNodeUpdateSchema = z.strictObject({
    ...nodeFields,
    workspaceId: id.optional(),
    expectedRevision: revision,
});
export const StorageNodeStateSchema = FacilityStateSchema.extend({ workspaceId: id.optional() });
export const StorageNodeMoveSchema = z.strictObject({
    workspaceId: id.optional(),
    expectedRevision: revision,
    targetFacilityId: id,
    targetTopologyId: id,
    targetRevision: revision,
    parentId: id.nullable(),
    code: BusinessCodeInputSchema(160),
    rowIndex: coordinate.default(null),
    columnIndex: coordinate.default(null),
});
export const StorageNodeReorderSchema = z.strictObject({
    workspaceId: id.optional(),
    expectedRevision: revision,
    beforeNodeId: id.nullable(),
});
export const StorageGridSchema = z.strictObject({
    workspaceId: id.optional(),
    expectedRevision: revision,
    positions: z
        .array(
            z.strictObject({
                code: BusinessCodeInputSchema(160),
                name: text,
                rowIndex: coordinate.unwrap(),
                columnIndex: coordinate.unwrap(),
            })
        )
        .min(1)
        .max(1000),
});
export const StorageQuerySchema = FacilityReadQuerySchema.extend({
    parentId: id.optional(),
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    q: z.string().trim().max(160).default(''),
    mode: z.enum(['children', 'search', 'positions']).default('children'),
    state: z.enum(['active', 'archived', 'all']).default('active'),
});
export const FacilityCapabilitiesSchema = z.strictObject({
    read: z.boolean(),
    use: z.boolean(),
    manage: z.boolean(),
    govern: z.boolean(),
});
export const FacilitySchema = z.strictObject({
    id,
    resourceId: id,
    organizationId: id,
    code: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    managementWorkspaceId: id,
    revision,
    disabledAt: timestamp,
    archivedAt: timestamp,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    capabilities: FacilityCapabilitiesSchema,
});
export const FacilityPageSchema = z.strictObject({
    items: z.array(FacilitySchema),
    total: z.number().int().nonnegative(),
    page: z.number().int(),
    pageSize: z.number().int(),
});
export const FacilityDetailSchema = FacilitySchema.extend({
    topology: z.strictObject({ id, resourceId: id, name: z.string(), revision }).nullable(),
    workspaceAccess: z
        .array(
            z.strictObject({ workspaceId: id, name: z.string(), level: z.enum(['USE', 'MANAGE']) })
        )
        .nullable(),
    nodeCount: z.number().int().nonnegative(),
});
export const StorageNodeSchema = z.strictObject({
    id,
    resourceId: id,
    organizationId: id,
    facilityId: id,
    topologyId: id,
    parentId: id.nullable(),
    code: z.string().nullable(),
    name: z.string(),
    kind: z.enum(['CONTAINER', 'POSITION']),
    containerType: StorageContainerTypeSchema.nullable(),
    description: z.string().nullable(),
    rowIndex: coordinate,
    columnIndex: coordinate,
    rowCount: coordinate,
    columnCount: coordinate,
    sortOrder: z.number().int(),
    disabledAt: timestamp,
    archivedAt: timestamp,
    occupied: z.boolean(),
    hasChildren: z.boolean(),
    usable: z.boolean(),
    unavailableReason: z
        .enum(['archived', 'disabled', 'occupied', 'not-position', 'no-use-permission'])
        .nullable(),
});
export const StorageNodeDetailSchema = z.strictObject({
    node: StorageNodeSchema,
    revision,
    ancestors: z.array(z.strictObject({ id, code: z.string().nullable(), name: z.string() })),
    capabilities: FacilityCapabilitiesSchema,
});
export const StorageNodePageSchema = z.strictObject({
    items: z.array(StorageNodeSchema),
    revision,
    nextCursor: z.string().nullable(),
    hasNextPage: z.boolean(),
});
export const StorageMutationSchema = z.strictObject({ revision });
export const StorageMoveResultSchema = z.strictObject({
    sourceRevision: revision,
    targetRevision: revision,
});
export type FacilityScope = z.infer<typeof FacilityScopeSchema>;
export type FacilityParams = z.infer<typeof FacilityParamsSchema>;
export type StorageParams = z.infer<typeof StorageParamsSchema>;
export type StorageNodeParams = z.infer<typeof StorageNodeParamsSchema>;
export type FacilityQuery = z.infer<typeof FacilityQuerySchema>;
export type FacilityWrite = z.infer<typeof FacilityWriteSchema>;
export type FacilityUpdate = z.infer<typeof FacilityUpdateSchema>;
export type FacilityState = z.infer<typeof FacilityStateSchema>;
export type FacilityGrant = z.infer<typeof FacilityGrantSchema>;
export type FacilityCapabilities = z.infer<typeof FacilityCapabilitiesSchema>;
export type StorageNodeCreate = z.infer<typeof StorageNodeCreateSchema>;
export type StorageNodeUpdate = z.infer<typeof StorageNodeUpdateSchema>;
export type StorageNodeState = z.infer<typeof StorageNodeStateSchema>;
export type StorageNodeMove = z.infer<typeof StorageNodeMoveSchema>;
export type StorageNodeReorder = z.infer<typeof StorageNodeReorderSchema>;
export type StorageGrid = z.infer<typeof StorageGridSchema>;
export type StorageQuery = z.infer<typeof StorageQuerySchema>;
