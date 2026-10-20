import { Injectable } from '@nestjs/common';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { PermissionKernel } from '@/core/permission/index.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { organizationPermission } from '@/core/team-governance/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import { ApprovalAccessService } from './approval-access.service.js';
import { ApprovalError } from './approval.error.js';
import { approvalPermission } from '../contribution/approval-authorization.contribution.js';

@Injectable()
export class ApprovalGovernanceService {
    constructor(
        private readonly authorization: AuthorizationKernel,
        private readonly permissions: PermissionKernel,
        private readonly writes: OrganizationWriteKernel,
        private readonly audit: AuditKernel,
        private readonly access: ApprovalAccessService
    ) {}
    initialize(organizationId: string) {
        return this.writes.run({
            organizationId,
            authorize: async () => {
                const context = await this.authorization.require({
                    subject: this.access.subject(),
                    target: { kind: 'organization', organizationId },
                    permissionCode: organizationPermission.read,
                });
                if (!context.organization.isOwner && !context.organization.isSuperAdmin)
                    throw new ApprovalError({ reason: 'forbidden' });
            },
            execute: async () => {
                const role = await this.permissions.findRole({
                    organizationId,
                    scope: 'WORKSPACE',
                    code: 'workspace-manager',
                });
                if (!role || role.archivedAt) throw new ApprovalError({ reason: 'state' });
                const permissions = [
                    ...new Set([...role.permissions, ...Object.values(approvalPermission)]),
                ];
                const updated = role.permissions.length !== permissions.length;
                if (updated) {
                    await this.permissions.setRolePermissions({
                        organizationId,
                        roleId: role.id,
                        permissions,
                    });
                    await this.audit.record({
                        organizationId,
                        actorUserId: this.access.subject().userId,
                        action: 'approval.initialize',
                        occurredAt: new Date(),
                        details: { roleId: role.id },
                    });
                }
                return { updated };
            },
        });
    }
}
