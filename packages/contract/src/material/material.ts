import { z } from 'zod';
import { BusinessCodeInputSchema, NulFreeTextSchema, UuidSchema } from '../protocol/scalar.js';
import { WorkspaceContextParamsSchema } from '../team/team.http.js';

const singleLine = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        // eslint-disable-next-line no-control-regex -- Exclude control characters from identifiers and labels.
        .regex(/^[^\u0000-\u001f\u007f-\u009f\ud800-\udfff]*$/u);
const text = (max: number) => singleLine(max).min(1);
const optionalText = (max: number) => singleLine(max).default('');
export const MaterialBranchSchema = z.enum(['consumable', 'chemical', 'biological']);
export const MaterialAttributesSchema = {
    consumable: z.strictObject({
        specification: optionalText(300),
        packaging: optionalText(300),
        composition: optionalText(300),
    }),
    chemical: z.strictObject({
        molecularFormula: optionalText(200),
        purityOrConcentration: optionalText(300),
        physicalForm: optionalText(200),
    }),
    biological: z.strictObject({
        source: optionalText(300),
        species: optionalText(200),
        storageConditions: optionalText(300),
    }),
};
export const MaterialIdentifierSchema = z.strictObject({
    scheme: text(40)
        .toLowerCase()
        .regex(/^[a-z][a-z0-9._-]*$/),
    value: text(200),
});
const aliases = z
    .array(text(200))
    .max(40)
    .refine(
        (values) => new Set(values).size === values.length,
        'Aliases must be unique within a material'
    );
const identifiers = z
    .array(MaterialIdentifierSchema)
    .max(50)
    .refine(
        (values) =>
            new Set(values.map((item) => JSON.stringify([item.scheme, item.value]))).size ===
            values.length,
        'Identifiers must be unique within a material'
    );
const write = z.strictObject({
    code: BusinessCodeInputSchema(80),
    name: text(200),
    typeId: UuidSchema.toLowerCase(),
    description: NulFreeTextSchema.trim().max(4000).default(''),
    manufacturer: optionalText(200),
    catalogNumber: optionalText(200),
    quantityUnit: text(32),
    quantityScale: z.number().int().min(0).max(6).default(6),
    aliases: aliases.default([]),
    identifiers: identifiers.default([]),
});
export const MaterialWriteSchema = z.discriminatedUnion('branch', [
    write.extend({
        branch: z.literal('consumable'),
        attributes: MaterialAttributesSchema.consumable,
    }),
    write.extend({ branch: z.literal('chemical'), attributes: MaterialAttributesSchema.chemical }),
    write.extend({
        branch: z.literal('biological'),
        attributes: MaterialAttributesSchema.biological,
    }),
]);
export const MaterialTypeWriteSchema = z.strictObject({
    code: BusinessCodeInputSchema(80),
    name: text(200),
});
export const MaterialArchiveSchema = z.strictObject({ archived: z.boolean() });
export const MaterialScopeSchema = WorkspaceContextParamsSchema;
export const MaterialParamsSchema = MaterialScopeSchema.extend({
    materialId: UuidSchema.toLowerCase(),
});
export const MaterialTypeParamsSchema = MaterialScopeSchema.extend({
    typeId: UuidSchema.toLowerCase(),
});
export const MaterialQuerySchema = z.strictObject({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    q: singleLine(200).default(''),
    branch: z.preprocess(
        (value) => (typeof value === 'string' && value.includes(',') ? value.split(',') : value),
        z.union([MaterialBranchSchema, z.array(MaterialBranchSchema).max(3)]).optional()
    ),
    typeId: z.preprocess(
        (value) => (typeof value === 'string' && value.includes(',') ? value.split(',') : value),
        z.union([UuidSchema, z.array(UuidSchema).max(100)]).optional()
    ),
    state: z.enum(['active', 'archived', 'all']).default('active'),
    sort: z
        .string()
        .max(200)
        .regex(
            /^(code|name|branch|type|manufacturer|quantityUnit|createdAt|updatedAt|status):(asc|desc)(,(code|name|branch|type|manufacturer|quantityUnit|createdAt|updatedAt|status):(asc|desc)){0,8}$/
        )
        .default('updatedAt:desc'),
});
export const MaterialCapabilitiesSchema = z.object({
    read: z.boolean(),
    create: z.boolean(),
    update: z.boolean(),
    archive: z.boolean(),
    manageType: z.boolean(),
});
export const MaterialTypeSchema = z.object({
    id: UuidSchema,
    organizationId: UuidSchema,
    workspaceId: UuidSchema,
    code: z.string().nullable(),
    name: z.string(),
    archivedAt: z.iso.datetime().nullable(),
});
const snapshot = write.extend({
    code: text(80).nullable(),
    id: UuidSchema,
    resourceId: UuidSchema,
    organizationId: UuidSchema,
    workspaceId: UuidSchema,
    type: MaterialTypeSchema,
    archivedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    instanceCount: z.number().int().nonnegative(),
});
export const MaterialSchema = z.discriminatedUnion('branch', [
    snapshot.extend({
        branch: z.literal('consumable'),
        attributes: MaterialAttributesSchema.consumable,
    }),
    snapshot.extend({
        branch: z.literal('chemical'),
        attributes: MaterialAttributesSchema.chemical,
    }),
    snapshot.extend({
        branch: z.literal('biological'),
        attributes: MaterialAttributesSchema.biological,
    }),
]);
export const MaterialPageSchema = z.object({
    items: z.array(MaterialSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    capabilities: MaterialCapabilitiesSchema,
});
export const MaterialDetailSchema = z.object({
    material: MaterialSchema,
    capabilities: MaterialCapabilitiesSchema,
});
export const MaterialTypeListSchema = z.object({
    items: z.array(MaterialTypeSchema),
    capabilities: MaterialCapabilitiesSchema,
});
export const MaterialOverviewSchema = z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    archived: z.number().int().nonnegative(),
    branches: z.array(
        z.object({ branch: MaterialBranchSchema, count: z.number().int().nonnegative() })
    ),
    recent: z.array(MaterialSchema),
    creations: z.object({
        from: z.iso.datetime(),
        to: z.iso.datetime(),
        timeZone: z.literal('UTC'),
        points: z
            .array(
                z.object({
                    from: z.iso.datetime(),
                    to: z.iso.datetime(),
                    count: z.number().int().nonnegative(),
                })
            )
            .length(4),
    }),
    capabilities: MaterialCapabilitiesSchema,
});
export type Material = z.infer<typeof MaterialSchema>;
export type MaterialBranch = z.infer<typeof MaterialBranchSchema>;
export type MaterialWrite = z.infer<typeof MaterialWriteSchema>;
export type MaterialTypeWrite = z.infer<typeof MaterialTypeWriteSchema>;
export type MaterialType = z.infer<typeof MaterialTypeSchema>;
export type MaterialScope = z.infer<typeof MaterialScopeSchema>;
export type MaterialParams = z.infer<typeof MaterialParamsSchema>;
export type MaterialTypeParams = z.infer<typeof MaterialTypeParamsSchema>;
export type MaterialQuery = z.infer<typeof MaterialQuerySchema>;
export type MaterialArchive = z.infer<typeof MaterialArchiveSchema>;
export type MaterialCapabilities = z.infer<typeof MaterialCapabilitiesSchema>;
export type MaterialPage = z.infer<typeof MaterialPageSchema>;
export type MaterialDetail = z.infer<typeof MaterialDetailSchema>;
export type MaterialTypeList = z.infer<typeof MaterialTypeListSchema>;
export type MaterialOverview = z.infer<typeof MaterialOverviewSchema>;
