import type {
    AuthorizationDefinition,
    AuthorizationMetadata,
} from '@/core/permission/authorization-definition.js';
import type { ExtensionEntry } from '@/platform/extensions/index.js';

export const organizationPermission = {
    read: 'organization.read',
    members: 'organization.member.manage',
    roles: 'organization.role.manage',
    invitations: 'organization.invitation.manage',
} as const;

export type OrganizationGovernancePermission =
    (typeof organizationPermission)[keyof typeof organizationPermission];

export const organizationReadAuthorization = Object.freeze({
    code: organizationPermission.read,
    name: 'Read organization',
    scope: 'ORGANIZATION',
} as const satisfies AuthorizationDefinition);

export const organizationAuthorizationEntries = Object.freeze(
    [
        organizationReadAuthorization,
        {
            code: organizationPermission.members,
            name: 'Manage organization members',
            scope: 'ORGANIZATION',
        },
        {
            code: organizationPermission.roles,
            name: 'Manage organization roles',
            scope: 'ORGANIZATION',
        },
        {
            code: organizationPermission.invitations,
            name: 'Manage organization invitations',
            scope: 'ORGANIZATION',
        },
    ].map((value) => ({
        key: value.code,
        value: { ...value, scope: 'ORGANIZATION' as const },
        source: Object.freeze({ kind: 'explicit', owner: 'organization' } as const),
    })) satisfies readonly ExtensionEntry<string, AuthorizationDefinition>[]
);

export const workspacePermission = {
    create: 'workspace.create',
    read: 'workspace.read',
    members: 'workspace.member.manage',
    update: 'workspace.update',
    audit: 'workspace.audit.read',
} as const;

export const workspaceCreateAuthorization = Object.freeze({
    code: workspacePermission.create,
    name: 'Create workspace',
    scope: 'ORGANIZATION',
} as const satisfies AuthorizationDefinition);
export const workspaceReadAuthorization = Object.freeze({
    code: workspacePermission.read,
    name: 'Read workspace',
    scope: 'WORKSPACE',
} as const satisfies AuthorizationDefinition);

export const workspaceAuthorization = Object.freeze({
    namespace: 'workspace',
    definitions: Object.freeze([
        workspaceCreateAuthorization,
        workspaceReadAuthorization,
        {
            code: workspacePermission.members,
            name: 'Manage workspace members',
            scope: 'WORKSPACE',
        } as const,
        {
            code: workspacePermission.update,
            name: 'Update workspace details',
            scope: 'WORKSPACE',
        } as const,
        {
            code: workspacePermission.audit,
            name: 'Read workspace management activity',
            scope: 'WORKSPACE',
        } as const,
    ]),
} satisfies AuthorizationMetadata);
