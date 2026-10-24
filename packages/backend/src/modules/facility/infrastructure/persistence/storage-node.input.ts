import { z } from 'zod';
import { StorageContainerTypeSchema } from '@talos-ark/contracts/facility';
import { BusinessCodeInputSchema } from '@talos-ark/contracts/protocol';
import { validationDiagnostics } from '@/platform/error/error.validation.js';
import { FacilityError } from '../../facility.error.js';

export const storageNodeIdSchema = z.uuid().transform((value) => value.toLowerCase());
const scopeSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('none') }),
    z.strictObject({
        kind: z.literal('topology'),
        organizationId: storageNodeIdSchema,
        topologyId: storageNodeIdSchema,
    }),
    z.strictObject({
        kind: z.literal('subtree'),
        organizationId: storageNodeIdSchema,
        topologyId: storageNodeIdSchema,
        rootNodeIds: z
            .array(storageNodeIdSchema)
            .max(200)
            .transform((ids) => [...new Set(ids)].sort()),
    }),
]);
const context = {
    organizationId: storageNodeIdSchema,
    topologyId: storageNodeIdSchema,
};
const int32 = z.number().int().min(-2_147_483_648).max(2_147_483_647);
const paging = {
    ...context,
    scope: scopeSchema,
    cursor: z.string().min(1).max(512).optional(),
    limit: z.number().int().min(1).max(100).default(50),
};

export const storageNodeLookupSchema = z.strictObject({
    ...context,
    scope: scopeSchema,
    nodeId: storageNodeIdSchema,
});
export const storageNodeChildrenSchema = z.strictObject({
    ...paging,
    parentId: storageNodeIdSchema.nullable(),
});
export const storageNodeDescendantsSchema = z.strictObject({
    ...paging,
    rootNodeId: storageNodeIdSchema,
});
export const storageNodeCreateSchema = z.strictObject({
    ...context,
    id: storageNodeIdSchema,
    resourceId: storageNodeIdSchema,
    parentId: storageNodeIdSchema.nullable(),
    code: BusinessCodeInputSchema(160),
    name: z
        .string()
        .min(1)
        .refine((value) => !value.includes('\u0000')),
    kind: z.enum(['CONTAINER', 'POSITION']),
    containerType: StorageContainerTypeSchema.optional(),
    description: z.string().max(2000).optional(),
    rowCount: z.number().int().min(1).max(10000).optional(),
    columnCount: z.number().int().min(1).max(10000).optional(),
    rowIndex: int32.optional(),
    columnIndex: int32.optional(),
    sortOrder: int32.default(0),
});
export const storageNodeMoveSchema = z.strictObject({
    ...context,
    targetTopologyId: storageNodeIdSchema,
    nodeId: storageNodeIdSchema,
    parentId: storageNodeIdSchema.nullable(),
    code: BusinessCodeInputSchema(160),
    rowIndex: z.number().int().min(1).max(10000).optional(),
    columnIndex: z.number().int().min(1).max(10000).optional(),
});

export function parseStorageNodeInput<Schema extends z.ZodType>(
    schema: Schema,
    input: unknown
): z.output<Schema> {
    const result = schema.safeParse(input);
    if (!result.success)
        throw new FacilityError(
            { reason: 'invalid-input' },
            {
                validationIssues: validationDiagnostics(result.error, input, {
                    fields: {
                        organizationId: {},
                        topologyId: {},
                        id: {},
                        resourceId: {},
                        nodeId: {},
                        parentId: {},
                        rootNodeId: {},
                        scope: {},
                        code: {},
                        name: {},
                        kind: {},
                        rowIndex: { scalar: true },
                        columnIndex: { scalar: true },
                        sortOrder: { scalar: true },
                        limit: { scalar: true },
                        cursor: {},
                    },
                }),
            }
        );
    return result.data;
}
