import { z } from 'zod';
import {
    ConsumptionSchema,
    QuantityAdjustmentSchema,
    DisposalSchema,
    TransferSchema,
    OperationReceiptSchema,
} from '@talos-ark/contracts/inventory';
import { facilityOutputSchema, receiptOutputSchema } from './seed.kind.js';
import type { SeederKind } from '../seed.definition.js';

export const inventoryHistoryKind = {
    id: 'inventory-history',
    data: z.strictObject({
        actions: z
            .array(
                z.strictObject({
                    stockIndex: z.number().int().nonnegative(),
                    action: z.discriminatedUnion('kind', [
                        z.strictObject({
                            kind: z.literal('consume'),
                            body: ConsumptionSchema.omit({
                                expectedVersion: true,
                                idempotencyKey: true,
                            }),
                        }),
                        z.strictObject({
                            kind: z.literal('adjust'),
                            body: QuantityAdjustmentSchema.omit({
                                expectedVersion: true,
                                idempotencyKey: true,
                            }),
                        }),
                        z.strictObject({
                            kind: z.literal('dispose'),
                            body: DisposalSchema.omit({
                                expectedVersion: true,
                                idempotencyKey: true,
                            }),
                        }),
                        z.strictObject({
                            kind: z.literal('transfer'),
                            body: TransferSchema.omit({
                                expectedVersion: true,
                                idempotencyKey: true,
                                position: true,
                            }),
                            targetPosition: z.number().int().nonnegative(),
                        }),
                    ]),
                })
            )
            .max(500),
    }),
    input: z.strictObject({ receipt: receiptOutputSchema, facility: facilityOutputSchema }),
    output: z.array(OperationReceiptSchema),
} satisfies SeederKind;
