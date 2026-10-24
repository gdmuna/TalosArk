import { z } from 'zod';
import { ReceiptSchema, InstanceFactsSchema } from '@talos-ark/contracts/inventory';
import { scopeReferenceSchema } from '../../definition/reference.js';
import { materialOutputSchema } from '../material/material.kind.js';
import { facilityOutputSchema } from '../facility/facility.kind.js';
import { type SeederKind } from '../../definition/dataset.js';
export const receiptOutputSchema = z.strictObject({
    scope: scopeReferenceSchema,
    stocks: z.array(
        z.strictObject({ stockItemId: z.uuid(), instanceId: z.uuid(), operationId: z.uuid() })
    ),
});
export const receiptKind = {
    id: 'receipt',
    version: 1,
    data: ReceiptSchema.pick({ quantity: true }).extend({
        facts: z.array(InstanceFactsSchema).default([]),
    }),
    input: z.strictObject({
        materials: materialOutputSchema,
        facility: facilityOutputSchema,
        batches: z
            .record(
                z.string(),
                z.strictObject({
                    id: z.uuid(),
                    materialId: z.uuid(),
                    revision: z.number().int().positive(),
                    archivedAt: z.iso.datetime().nullable(),
                })
            )
            .default({}),
    }),
    output: receiptOutputSchema,
} satisfies SeederKind;
