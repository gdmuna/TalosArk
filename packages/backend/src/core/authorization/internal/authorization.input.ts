import { z } from 'zod';
import { validationDiagnostics } from '@/platform/error/error.validation.js';
import type { PermissionScope } from '@/core/permission/index.js';
import type { AuthorizationRequest } from '../authorization.contract.js';
import type { AuthorizationTargetMetadata } from '../authorization-target.provider.js';
import { AuthorizationTargetError } from '../authorization-target.error.js';

const idSchema = z.uuid().transform((value) => value.toLowerCase());
const scopeSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('organization'), organizationId: idSchema }),
    z.strictObject({
        kind: z.literal('workspace'),
        organizationId: idSchema,
        workspaceId: idSchema,
    }),
]);
export const targetKindSchema = z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,63}$/)
    .refine((kind) => kind !== 'organization' && kind !== 'workspace');
const requestSchema = z.strictObject({
    subject: z.strictObject({ kind: z.literal('user'), userId: idSchema }),
    permissionCode: z
        .string()
        .max(120)
        .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/),
    target: z.union([scopeSchema, z.strictObject({ kind: targetKindSchema, id: idSchema })]),
    expectedScope: scopeSchema.optional(),
});

export function parseAuthorizationRequest(input: AuthorizationRequest): AuthorizationRequest {
    const result = requestSchema.safeParse(input);
    if (!result.success)
        throw new AuthorizationTargetError(
            { reason: 'invalid-input' },
            {
                validationIssues: validationDiagnostics(result.error, input, {
                    fields: { subject: {}, permissionCode: {}, target: {}, expectedScope: {} },
                }),
            }
        );
    return Object.freeze({
        ...result.data,
        subject: Object.freeze(result.data.subject),
        target: Object.freeze(result.data.target),
        expectedScope: result.data.expectedScope && Object.freeze(result.data.expectedScope),
    });
}

export function parseTargetMetadata(input: unknown): AuthorizationTargetMetadata {
    const result = z.strictObject({ kind: targetKindSchema }).safeParse(input);
    if (!result.success) throw new AuthorizationTargetError({ reason: 'invalid-provider' });
    return Object.freeze(result.data);
}

export function parseTargetFacts(input: unknown, kind: string): PermissionScope {
    const result = z.strictObject({ scope: scopeSchema }).safeParse(input);
    if (!result.success)
        throw new AuthorizationTargetError(
            { reason: 'invalid-facts', kind },
            {
                validationIssues: validationDiagnostics(result.error, input, {
                    fields: { scope: {} },
                }),
            }
        );
    return Object.freeze(result.data.scope);
}
