import { Injectable } from '@nestjs/common';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { PermissionKernel } from '@/core/permission/index.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { organizationPermission } from '@/core/team-governance/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { inventoryPermission } from '../contribution/inventory-authorization.contribution.js';
import { materialPermission } from '@/modules/material/public/index.js';
import { InventoryError } from './inventory.error.js';
@Injectable()
export class InventoryGovernanceService {
    constructor(
        private readonly authorization: AuthorizationKernel,
        private readonly policies: PermissionKernel,
        private readonly writes: OrganizationWriteKernel,
        private readonly actor: AlsContextAdapter,
        private readonly audit: AuditKernel
    ) {}
    private async owner(organizationId: string) {
        const result = await this.authorization.require({
            subject: { kind: 'user', userId: this.actor.requireActor().userId },
            target: { kind: 'organization', organizationId },
            permissionCode: organizationPermission.read,
        });
        if (!result.organization.isOwner && !result.organization.isSuperAdmin)
            throw new InventoryError({ reason: 'forbidden' });
    }
    initialize(organizationId: string) {
        return this.writes.run({
            organizationId,
            authorize: () => this.owner(organizationId),
            execute: async () => {
                const role = await this.policies.findRole({
                    organizationId,
                    scope: 'WORKSPACE',
                    code: 'workspace-manager',
                });
                if (!role || role.archivedAt) throw new InventoryError({ reason: 'state' });
                const permissions = [
                    ...new Set([
                        ...role.permissions,
                        ...Object.values(inventoryPermission),
                        materialPermission.manageBatch,
                    ]),
                ];
                const updated = permissions.length !== role.permissions.length;
                if (updated) {
                    await this.policies.setRolePermissions({
                        organizationId,
                        roleId: role.id,
                        permissions,
                    });
                    await this.audit.record({
                        organizationId,
                        actorUserId: this.actor.requireActor().userId,
                        action: 'inventory.initialize',
                        occurredAt: new Date(),
                        details: { roleId: role.id },
                    });
                }
                return { updated };
            },
        });
    }
}
