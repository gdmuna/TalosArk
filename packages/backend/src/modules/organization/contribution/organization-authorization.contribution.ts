import type { AuthorizationDefinition } from '@/core/permission/authorization-definition.js';
import type { ExtensionEntry } from '@/platform/extensions/index.js';

export const organizationPermission = {
    read: 'organization.read',
    members: 'organization.member.manage',
    roles: 'organization.role.manage',
    invitations: 'organization.invitation.manage',
} as const;
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
