import { z } from 'zod';
import {
    MaterialTypeWriteSchema,
    MaterialWriteSchema,
    MaterialBranchSchema,
    MaterialSchema,
} from '@talos-ark/contracts/material';
import { type SeederKind } from '../../definition/dataset.js';
import { scopeReferenceSchema } from '../../definition/reference.js';

const key = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
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
    id: z.uuid(),
    resourceId: z.uuid(),
    code: MaterialSchema.options[0].shape.code,
    branch: MaterialBranchSchema,
});
export const materialOutputSchema = z.strictObject({
    scope: scopeReferenceSchema,
    types: z.record(z.string(), z.uuid()),
    materials: z.record(z.string(), materialReferenceSchema),
});
export type MaterialSeedData = z.output<typeof materialDataSchema>;
export type MaterialSeedInput = z.input<typeof materialDataSchema>;
export type MaterialSeedDraft = z.input<typeof materialSeedInputSchema>;
export type MaterialSeedOutput = z.output<typeof materialOutputSchema>;
export const materialKind = {
    id: 'material',
    version: 1,
    data: materialDataSchema,
    input: scopeReferenceSchema,
    output: materialOutputSchema,
} satisfies SeederKind;
