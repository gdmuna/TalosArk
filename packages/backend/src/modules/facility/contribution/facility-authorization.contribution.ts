import type { AuthorizationMetadata } from '@/core/permission/authorization-definition.js';

export const facilityPermission = {
    create: 'facility.create',
    govern: 'facility.govern',
    read: 'facility.read',
    use: 'facility.use',
    manage: 'facility.manage',
} as const;
export const facilityAuthorization = {
    namespace: 'facility',
    definitions: Object.entries(facilityPermission).map(([name, code]) => ({
        code,
        name: `Facility ${name}`,
        scope:
            name === 'create' || name === 'govern'
                ? ('ORGANIZATION' as const)
                : ('WORKSPACE' as const),
    })),
} satisfies AuthorizationMetadata;
