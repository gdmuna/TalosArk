import { z } from 'zod';
import { ApprovalTypeSchema } from '@talos-ark/contracts/approval';
import { accountsKind } from './account.kind.js';
import { receiptOutputSchema, facilityOutputSchema } from './seed.kind.js';
import type { SeederKind } from '../seed.definition.js';

export const approvalKind = {
    id: 'approval',
    data: z.strictObject({
        scenarios: z
            .array(
                z.strictObject({
                    key: z.string(),
                    type: ApprovalTypeSchema,
                    outcome: z.enum([
                        'pending',
                        'withdrawn',
                        'approved',
                        'rejected',
                        'mixed',
                        'executed',
                        'abandoned',
                        'revoked',
                    ]),
                    stockIndices: z.array(z.number().int().nonnegative()).min(1).max(2),
                    targetPosition: z.number().int().nonnegative().optional(),
                })
            )
            .max(100),
    }),
    input: z.strictObject({
        receipt: receiptOutputSchema,
        facility: facilityOutputSchema,
        reviewer: accountsKind.output.valueType,
    }),
    output: z.record(z.string(), z.uuid()),
} satisfies SeederKind;
