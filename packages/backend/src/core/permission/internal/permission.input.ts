import { z } from 'zod';
import { validationDiagnostics } from '@/platform/error/error.validation.js';
import { PermissionError } from '../permission.error.js';
import type {
    PermissionCheck,
    PermissionScope,
    PermissionScopeQuery,
} from '../permission.contract.js';

export const permissionIdSchema = z.uuid().transform((value) => value.toLowerCase());
export const permissionSubjectSchema = z.strictObject({
    kind: z.literal('user'),
    userId: permissionIdSchema,
});
export const permissionScopeSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('organization'), organizationId: permissionIdSchema }),
    z.strictObject({
        kind: z.literal('workspace'),
        organizationId: permissionIdSchema,
        workspaceId: permissionIdSchema,
    }),
]);
export const permissionCodeSchema = z
    .string()
    .max(120)
    .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/);
export const permissionCheckSchema = z.strictObject({
    subject: permissionSubjectSchema,
    permissionCode: permissionCodeSchema,
    scope: permissionScopeSchema,
});
export const permissionScopeQuerySchema = z.strictObject({
    subject: permissionSubjectSchema,
    permissionCode: permissionCodeSchema,
    within: permissionScopeSchema.optional(),
});

export function parsePermissionInput<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input, { reportInput: true });
    if (!result.success)
        throw new PermissionError(
            { reason: 'invalid-input' },
            { validationIssues: validationDiagnostics(result.error, input) }
        );
    return result.data;
}

export function parsePermissionCheck(input: PermissionCheck): PermissionCheck {
    const parsed = parsePermissionInput(permissionCheckSchema, input);
    return Object.freeze({
        ...parsed,
        subject: Object.freeze(parsed.subject),
        scope: Object.freeze(parsed.scope),
    });
}

export function parsePermissionQuery(input: PermissionScopeQuery): PermissionScopeQuery {
    const parsed = parsePermissionInput(permissionScopeQuerySchema, input);
    return Object.freeze({
        ...parsed,
        subject: Object.freeze(parsed.subject),
        within: parsed.within && Object.freeze(parsed.within),
    });
}

export function permissionDomain(scope: PermissionScope): string {
    return scope.kind === 'organization'
        ? `organization/${scope.organizationId}`
        : `workspace/${scope.organizationId}/${scope.workspaceId}`;
}
