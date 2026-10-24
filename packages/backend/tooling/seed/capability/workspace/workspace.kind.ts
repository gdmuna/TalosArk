import { z } from 'zod';
import { CreateOrganizationBodySchema } from '@talos-ark/contracts/team';
import { scopeSchema, scopeReferenceSchema } from '../../definition/reference.js';
import { type SeederKind } from '../../definition/dataset.js';
export const workspaceKind = {
    id: 'workspace',
    version: 1,
    data: CreateOrganizationBodySchema,
    input: z.strictObject({ actorUserId: z.uuid(), target: scopeSchema.nullable() }),
    output: scopeReferenceSchema,
} satisfies SeederKind;
