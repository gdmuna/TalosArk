import { z } from 'zod';
import { InventoryText } from '../material/batch.js';
import { QuantitySchema } from './inventory.js';

const revision = z.number().int().positive();
const idempotencyKey = z.string().regex(/^[\x21-\x7e]{1,255}$/);

const ActionBaseSchema = z.strictObject({
    expectedVersion: revision,
    idempotencyKey,
    reason: InventoryText(1000).default(''),
});

export const ConsumptionSchema = ActionBaseSchema.extend({
    quantity: QuantitySchema.refine((value) => /[1-9]/.test(value), {
        message: 'Consumption quantity must be greater than zero',
    }),
});

export const TransferSchema = ActionBaseSchema.extend({
    position: z.strictObject({
        facilityId: z.uuid().toLowerCase(),
        topologyId: z.uuid().toLowerCase(),
        nodeId: z.uuid().toLowerCase(),
    }),
});

export const QuantityAdjustmentSchema = ActionBaseSchema.extend({
    actualQuantity: QuantitySchema,
});

export const DisposalSchema = ActionBaseSchema;

export const InventoryActionSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('consume'), body: ConsumptionSchema }),
    z.strictObject({ kind: z.literal('transfer'), body: TransferSchema }),
    z.strictObject({ kind: z.literal('adjust'), body: QuantityAdjustmentSchema }),
    z.strictObject({ kind: z.literal('dispose'), body: DisposalSchema }),
]);
export type InventoryAction = z.infer<typeof InventoryActionSchema>;

export type Consumption = z.infer<typeof ConsumptionSchema>;
export type Transfer = z.infer<typeof TransferSchema>;
export type QuantityAdjustment = z.infer<typeof QuantityAdjustmentSchema>;
export type Disposal = z.infer<typeof DisposalSchema>;
