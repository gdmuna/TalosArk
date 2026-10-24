import { Injectable } from '@nestjs/common';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import {
    AuthorizationExtension,
    PermissionKernel,
    type PermissionSubject,
} from '@/core/permission/index.js';
import type { InventoryScope, InventoryCapabilitiesSchema } from '@talos-ark/contracts/inventory';
import type { z } from 'zod';
import { materialPermission } from '@/modules/material/public/index.js';
import {
    inventoryAuthorization,
    inventoryPermission as p,
} from '../contribution/inventory-authorization.contribution.js';

export function inventoryScope(input: InventoryScope): InventoryScope {
    return { organizationId: input.organizationId, workspaceId: input.workspaceId };
}
@Injectable()
@AuthorizationExtension(inventoryAuthorization)
export class InventoryAccessService {
    constructor(
        private readonly authorization: AuthorizationKernel,
        private readonly policies: PermissionKernel
    ) {}
    async require(subject: PermissionSubject, input: InventoryScope, permission: string = p.read) {
        const target = { kind: 'workspace' as const, ...inventoryScope(input) };
        for (const permissionCode of new Set([materialPermission.read, p.read, permission]))
            await this.authorization.require({ subject, target, permissionCode });
    }
    async capabilities(subject: PermissionSubject, input: InventoryScope) {
        const keys = { ...p, manageBatch: materialPermission.manageBatch };
        const entries = Object.entries(keys);
        const decisions = await this.policies.evaluateMany(
            entries.map(([, permissionCode]) => ({
                subject,
                scope: { kind: 'workspace' as const, ...inventoryScope(input) },
                permissionCode,
            }))
        );
        return Object.fromEntries(
            entries.map(([name], index) => [name, decisions[index].allowed])
        ) as z.infer<typeof InventoryCapabilitiesSchema>;
    }
}
