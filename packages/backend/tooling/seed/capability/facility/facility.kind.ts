import { z } from 'zod';
import { scopeReferenceSchema } from '../../definition/reference.js';
import { type SeederKind } from '../../definition/dataset.js';

export const facilityOutputSchema = z.strictObject({
    scope: scopeReferenceSchema,
    facilityId: z.uuid(),
    topologyId: z.uuid(),
    containerId: z.uuid(),
    positions: z.array(z.uuid()),
});

export const facilityKind = {
    id: 'facility',
    version: 1,
    data: z.strictObject({
        positions: z.number().int().min(1).max(100),
        name: z.string().min(1).max(120),
    }),
    input: scopeReferenceSchema,
    output: facilityOutputSchema,
} satisfies SeederKind;
