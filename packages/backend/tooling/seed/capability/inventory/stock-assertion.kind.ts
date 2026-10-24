import { z } from 'zod';
import { StockSchema } from '@talos-ark/contracts/inventory';
import type { SeederKind } from '../../definition/dataset.js';
import { receiptOutputSchema } from './receipt.kind.js';
import { facilityOutputSchema } from '../facility/facility.kind.js';

export const stockAssertionKind = {
    id: 'inventory-stock-assertion',
    version: 1,
    effect: 'assertion',
    data: z
        .strictObject({
            expectations: z
                .array(
                    StockSchema.pick({ quantity: true, status: true }).extend({
                        stockIndex: z.number().int().nonnegative(),
                        positionIndex: z.number().int().nonnegative().nullable(),
                    })
                )
                .min(1)
                .max(100),
        })
        .refine(
            (data) =>
                new Set(data.expectations.map((item) => item.stockIndex)).size ===
                data.expectations.length,
            'Duplicate stock expectation'
        ),
    input: z.strictObject({ receipt: receiptOutputSchema, facility: facilityOutputSchema }),
    output: z.strictObject({ checked: z.number().int().positive() }),
} satisfies SeederKind;
