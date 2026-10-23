import { z } from 'zod';
import { MaterialAttachmentBeginSchema } from '@talos-ark/contracts/material';
import { materialOutputSchema } from './seed.kind.js';
import type { SeederKind } from '../seed.definition.js';

export const attachmentKind = {
    id: 'attachment',
    data: z.strictObject({
        files: z
            .array(
                z.strictObject({
                    key: z.string(),
                    input: MaterialAttachmentBeginSchema.omit({
                        idempotencyKey: true,
                        sha256: true,
                        sizeBytes: true,
                    }),
                    text: z.string().min(1).max(1024),
                    repeat: z.number().int().min(1).max(1000000),
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
