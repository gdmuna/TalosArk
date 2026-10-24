import { z } from 'zod';
import { jsonSchema } from '../definition/value.js';
import { seedScopeSchema } from '../definition/scope.js';
export const seedPlanRequestSchema = z.strictObject({
    selection: z.discriminatedUnion('kind', [
        z.strictObject({
            kind: z.literal('group'),
            id: z.string().min(1),
            parameters: jsonSchema.optional(),
        }),
        z.strictObject({
            kind: z.literal('dataset'),
            id: z.string().min(1),
            parameters: jsonSchema.optional(),
        }),
        z.strictObject({ kind: z.literal('tags'), tags: z.array(z.string().min(1)).min(1) }),
    ]),
    namespace: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
    generation: z.strictObject({
        seed: z.number().int().min(0).max(0xffffffff),
        referenceDate: z.iso.date(),
    }),
    scope: seedScopeSchema,
});
export type SeedPlanRequest = z.infer<typeof seedPlanRequestSchema>;
