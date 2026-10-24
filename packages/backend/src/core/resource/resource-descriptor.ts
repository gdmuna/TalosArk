import type { PermissionScope } from '@/core/permission/index.js';
import { validationDiagnostics } from '@/platform/error/error.validation.js';
import { z } from 'zod';
import { RESOURCE_KINDS, type ResourceKind } from './resource-identity.js';
import { ResourceError } from './resource.error.js';

const id = z.uuid().transform((value) => value.toLowerCase());
const scope = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('organization'), organizationId: id }),
    z.strictObject({
        kind: z.literal('workspace'),
        organizationId: id,
        workspaceId: id,
    }),
]);

const text = (max: number) =>
    z
        .string()
        .min(1)
        .max(max)
        .refine((value) => value.isWellFormed())
        // eslint-disable-next-line no-control-regex -- Descriptors must not carry control bytes.
        .refine((value) => !/[\u0000-\u001f\u007f-\u009f]/.test(value));

export const resourceDescriptorSchema = z.strictObject({
    resourceId: id,
    kind: z.enum(RESOURCE_KINDS),
    objectId: text(200),
    scope,
    label: text(500),
    href: text(2048),
    archivedAt: z.date().nullable(),
});

export interface ResourceDescriptor {
    readonly resourceId: string;
    readonly kind: ResourceKind;
    readonly objectId: string;
    readonly scope: PermissionScope;
    readonly label: string;
    readonly href: string;
    readonly archivedAt: Date | null;
}

export function parseResourceDescriptor(input: unknown): ResourceDescriptor {
    const result = resourceDescriptorSchema.safeParse(input, { reportInput: true });
    if (!result.success)
        throw new ResourceError(
            { reason: 'invalid-descriptor' },
            {
                validationIssues: validationDiagnostics(result.error, input, {
                    fields: {
                        resourceId: { label: 'resourceId' },
                        kind: { label: 'kind' },
                        objectId: { label: 'objectId' },
                        scope: { label: 'scope' },
                        label: { label: 'label' },
                        href: { label: 'href' },
                        archivedAt: { label: 'archivedAt' },
                    },
                }),
            }
        );
    return result.data;
}
