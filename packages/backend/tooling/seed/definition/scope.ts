import { z } from 'zod';

export const seedScopeSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('provision') }),
    z.strictObject({ kind: z.literal('actor'), userId: z.uuid().toLowerCase() }),
    z.strictObject({
        kind: z.literal('workspace'),
        userId: z.uuid().toLowerCase(),
        organizationId: z.uuid().toLowerCase(),
        workspaceId: z.uuid().toLowerCase(),
    }),
]);
export type SeedScopeSelection = z.infer<typeof seedScopeSchema>;
