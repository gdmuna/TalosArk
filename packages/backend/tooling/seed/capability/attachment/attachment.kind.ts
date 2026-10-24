import { z } from 'zod';
import { MaterialAttachmentBeginSchema } from '@talos-ark/contracts/material';
import { materialOutputSchema } from '../material/material.kind.js';
import { type SeederKind } from '../../definition/dataset.js';
import { fixtureFileRefSchema } from '../../fixture/fixture.definition.js';

export const attachmentKind = {
    id: 'attachment',
    version: 2,
    data: z.strictObject({
        files: z
            .array(
                z.strictObject({
                    key: z.string(),
                    materialKey: z.string().min(1),
                    input: MaterialAttachmentBeginSchema.omit({
                        idempotencyKey: true,
                        sha256: true,
                        sizeBytes: true,
                    }),
                    source: z.discriminatedUnion('kind', [
                        fixtureFileRefSchema,
                        z.strictObject({
                            kind: z.literal('generated'),
                            text: z.string().min(1).max(1024),
                            repeat: z.number().int().min(1).max(1000000),
                        }),
                    ]),
                    unbind: z.boolean().default(false),
                })
            )
            .min(1)
            .max(10),
    }),
    input: materialOutputSchema,
    output: z.record(
        z.string(),
        z.strictObject({ sessionId: z.uuid(), assetId: z.uuid(), referenceId: z.uuid() })
    ),
} satisfies SeederKind;
