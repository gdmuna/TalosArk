import type { AuthorizationMetadata } from '@/core/permission/authorization-definition.js';

export const materialPermission = {
    read: 'material.read',
    create: 'material.create',
    update: 'material.update',
    archive: 'material.archive',
    manageType: 'material.type.manage',
} as const;
export const materialAuthorization = {
    namespace: 'material',
    definitions: Object.entries(materialPermission).map(([name, code]) => ({
        code,
        name: `Material ${name}`,
        scope: 'WORKSPACE' as const,
    })),
} satisfies AuthorizationMetadata;
