import type { AuthorizationMetadata } from '@/core/permission/authorization-definition.js';
export const inventoryPermission = {
    read: 'inventory.read',
    receive: 'inventory.receive',
    updateFacts: 'inventory.instance.update',
    transfer: 'inventory.transfer',
} as const;
export const inventoryAuthorization = {
    namespace: 'inventory',
    definitions: Object.entries(inventoryPermission).map(([name, code]) => ({
        code,
        name: `Inventory ${name}`,
        scope: 'WORKSPACE' as const,
    })),
} satisfies AuthorizationMetadata;
