import type { AuthorizationDefinition } from '@/core/permission/authorization-definition.js';
import type { ExtensionEntry } from '@/platform/extensions/index.js';

export const organizationPermission = { read: 'organization.read' } as const;
export const organizationReadAuthorization = Object.freeze({
    code: organizationPermission.read,
    name: 'Read organization',
    scope: 'ORGANIZATION',
} as const satisfies AuthorizationDefinition);

export const organizationAuthorizationEntries = Object.freeze([
    {
        key: organizationReadAuthorization.code,
        value: organizationReadAuthorization,
        source: Object.freeze({ kind: 'explicit', owner: 'organization' } as const),
    },
] as const satisfies readonly ExtensionEntry<string, AuthorizationDefinition>[]);
