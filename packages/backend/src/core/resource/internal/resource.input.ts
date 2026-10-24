import { z } from 'zod';
import { validationDiagnostics } from '@/platform/error/error.validation.js';
import type { CreateResourceIdentity } from '../resource-identity.js';
import { RESOURCE_KINDS } from '../resource-identity.js';
import type { ResourceLookup } from '../resource-provider.js';
import { ResourceError } from '../resource.error.js';

const id = z.uuid().transform((value) => value.toLowerCase());
const subject = z.strictObject({ kind: z.literal('user'), userId: id });
const scope = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('organization'), organizationId: id }),
    z.strictObject({
        kind: z.literal('workspace'),
        organizationId: id,
        workspaceId: id,
    }),
]);

const createSchema = z.strictObject({
    organizationId: id,
    kind: z.enum(RESOURCE_KINDS),
});
const lookupSchema = z.strictObject({
    resourceId: id,
    subject,
    expectedScope: scope.optional(),
    accessContext: scope.optional(),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input, { reportInput: true });
    if (!result.success)
        throw new ResourceError(
            { reason: 'invalid-input' },
            {
                validationIssues: validationDiagnostics(result.error, input, {
                    fields: {
                        organizationId: { label: 'organizationId' },
                        resourceId: { label: 'resourceId' },
                        kind: { label: 'kind' },
                        subject: { label: 'subject' },
                        expectedScope: { label: 'expectedScope' },
                        accessContext: { label: 'accessContext' },
                    },
                }),
            }
        );
    return result.data;
}

export function parseCreateResource(input: CreateResourceIdentity): CreateResourceIdentity {
    const parsed = parse(createSchema, input);
    return Object.freeze(parsed);
}

export function parseResourceLookup(input: ResourceLookup): ResourceLookup {
    const parsed = parse(lookupSchema, input);
    return Object.freeze({
        ...parsed,
        subject: Object.freeze(parsed.subject),
        expectedScope: parsed.expectedScope && Object.freeze(parsed.expectedScope),
        accessContext: parsed.accessContext && Object.freeze(parsed.accessContext),
    });
}
