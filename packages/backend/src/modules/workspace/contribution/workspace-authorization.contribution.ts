import type {
    AuthorizationDefinition,
    AuthorizationMetadata,
} from '@/core/permission/authorization-definition.js';

export const workspacePermission = { create: 'workspace.create', read: 'workspace.read' } as const;
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
    definitions: Object.freeze([workspaceCreateAuthorization, workspaceReadAuthorization]),
} satisfies AuthorizationMetadata);
