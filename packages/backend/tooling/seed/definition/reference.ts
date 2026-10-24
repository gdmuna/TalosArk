import { z } from 'zod';

export const scopeSchema = z.strictObject({ organizationId: z.uuid(), workspaceId: z.uuid() });
export const scopeReferenceSchema = scopeSchema.extend({ actorUserId: z.uuid() });
