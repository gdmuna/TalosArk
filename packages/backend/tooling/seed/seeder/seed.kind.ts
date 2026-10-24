import { z } from 'zod';
import {
    MaterialScopeSchema,
    MaterialTypeWriteSchema,
    MaterialWriteSchema,
    MaterialBranchSchema,
    MaterialSchema,
} from '@talos-ark/contracts/material';
import { CreateOrganizationBodySchema } from '@talos-ark/contracts/team';
import { ReceiptSchema, InstanceFactsSchema } from '@talos-ark/contracts/inventory';
import type { SeederKind } from '../seed.definition.js';

const key = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const id = z.uuid();
export const scopeSchema = MaterialScopeSchema;
export const scopeReferenceSchema = scopeSchema.extend({ actorUserId: id });

const [firstBranch, ...remainingBranches] = MaterialWriteSchema.options;
export const materialSeedInputSchema = z.discriminatedUnion('branch', [
    firstBranch.omit({ typeId: true }),
    ...remainingBranches.map((branch) => branch.omit({ typeId: true })),
]);
export const materialDataSchema = z
    .strictObject({
        types: z.array(z.strictObject({ key, input: MaterialTypeWriteSchema })).max(100),
        materials: z
            .array(
                z.strictObject({
                    key,
                    typeKey: key,
                    input: materialSeedInputSchema,
                    archived: z.boolean().default(false),
                })
            )
            .max(10000),
    })
    .superRefine((data, context) => {
        const types = new Set(data.types.map((type) => type.key));
        const typeCodes = data.types
            .map((type) => type.input.code)
            .filter((code) => typeof code === 'string');
        const materialCodes = data.materials
            .map((material) => material.input.code)
            .filter((code) => typeof code === 'string');
        if (types.size !== data.types.length || new Set(typeCodes).size !== typeCodes.length)
            context.addIssue({ code: 'custom', message: 'Duplicate classification key or code' });
        if (
            new Set(data.materials.map((material) => material.key)).size !==
                data.materials.length ||
            new Set(materialCodes).size !== materialCodes.length
        )
            context.addIssue({ code: 'custom', message: 'Duplicate material key or code' });
        for (const material of data.materials)
            if (!types.has(material.typeKey))
                context.addIssue({
                    code: 'custom',
                    message: `Unknown classification ${material.typeKey}`,
                });
    });
export const materialReferenceSchema = z.strictObject({
    id,
    resourceId: id,
    code: MaterialSchema.options[0].shape.code,
    branch: MaterialBranchSchema,
});
export const materialOutputSchema = z.strictObject({
    scope: scopeReferenceSchema,
    types: z.record(z.string(), id),
    materials: z.record(z.string(), materialReferenceSchema),
});
export type MaterialSeedData = z.infer<typeof materialDataSchema>;
export type MaterialSeedInput = z.input<typeof materialDataSchema>;
export type MaterialSeedDraft = z.input<typeof materialSeedInputSchema>;
export type MaterialSeedOutput = z.infer<typeof materialOutputSchema>;

const workspaceData = CreateOrganizationBodySchema;
const workspaceInput = z.strictObject({ actorUserId: id, target: scopeSchema.nullable() });
export const workspaceKind = {
    id: 'workspace',
    data: workspaceData,
    input: workspaceInput,
    output: scopeReferenceSchema,
} satisfies SeederKind;
export const materialKind = {
    id: 'material',
    data: materialDataSchema,
    input: scopeReferenceSchema,
    output: materialOutputSchema,
} satisfies SeederKind;

const facilityData = z.strictObject({
    positions: z.number().int().min(1).max(100),
    name: z.string().min(1).max(120),
});
export const facilityOutputSchema = z.strictObject({
    scope: scopeReferenceSchema,
    facilityId: id,
    topologyId: id,
    containerId: id,
    positions: z.array(id),
});
export const facilityKind = {
    id: 'facility',
    data: facilityData,
    input: scopeReferenceSchema,
    output: facilityOutputSchema,
} satisfies SeederKind;

const receiptData = ReceiptSchema.pick({ quantity: true }).extend({
    facts: z.array(InstanceFactsSchema).default([]),
});
const receiptInput = z.strictObject({
    materials: materialOutputSchema,
    facility: facilityOutputSchema,
    batches: z
        .record(
            z.string(),
            z.strictObject({
                id,
                materialId: id,
                revision: z.number().int().positive(),
                archivedAt: z.iso.datetime().nullable(),
            })
        )
        .default({}),
});
export const receiptOutputSchema = z.strictObject({
    scope: scopeReferenceSchema,
    stocks: z.array(z.strictObject({ stockItemId: id, instanceId: id, operationId: id })),
});
export const receiptKind = {
    id: 'receipt',
    data: receiptData,
    input: receiptInput,
    output: receiptOutputSchema,
} satisfies SeederKind;
