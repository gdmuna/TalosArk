import { z } from 'zod';
import { BatchWriteSchema, BatchSchema } from '@talos-ark/contracts/material';
import type { SeederKind } from '../seed.definition.js';
import { materialOutputSchema } from './seed.kind.js';

export const batchKind = {
    id: 'batch',
    data: z.strictObject({
        batches: z
            .array(
                z.strictObject({
                    key: z.string(),
                    materialIndex: z.number().int().nonnegative(),
                    input: BatchWriteSchema,
                    archived: z.boolean().default(false),
                })
            )
            .max(200),
    }),
    input: materialOutputSchema,
    output: z.record(
        z.string(),
        BatchSchema.pick({ id: true, materialId: true, revision: true, archivedAt: true })
    ),
} satisfies SeederKind;
