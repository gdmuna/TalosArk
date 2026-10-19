import { Injectable } from '@nestjs/common';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import {
    AuthorizationExtension,
    PermissionKernel,
    type PermissionSubject,
} from '@/core/permission/index.js';
import type { InventoryScope } from '@talos-ark/contracts/inventory';
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
        const decisions = await this.policies.evaluateMany(
            Object.values(keys).map((permissionCode) => ({
                subject,
                scope: { kind: 'workspace' as const, ...inventoryScope(input) },
                permissionCode,
            }))
        );
        return {
            read: decisions[0].allowed,
            receive: decisions[1].allowed,
            updateFacts: decisions[2].allowed,
            transfer: decisions[3].allowed,
            manageBatch: decisions[4].allowed,
        };
    }
}
