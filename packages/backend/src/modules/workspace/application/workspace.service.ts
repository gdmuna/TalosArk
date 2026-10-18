import { Inject, Injectable } from '@nestjs/common';
import type { CreateWorkspaceBody, WorkspaceSummary } from '@talos-ark/contracts/team';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationContextError } from '@/core/organization-context/index.js';
import { AuthorizationExtension, PermissionKernel } from '@/core/permission/index.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { WORKSPACE_MANAGER_PERMISSIONS } from '../workspace.configuration.js';

import { workspaceAuthorization, workspacePermission } from '@/core/team-governance/index.js';

@Injectable()
@AuthorizationExtension(workspaceAuthorization)
export class WorkspaceService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly permission: PermissionKernel,
        private readonly authorization: AuthorizationKernel,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter,
        @Inject(WORKSPACE_MANAGER_PERMISSIONS)
        private readonly managerPermissions: readonly string[]
    ) {}

    create(organizationId: string, input: CreateWorkspaceBody): Promise<WorkspaceSummary> {
        const { userId } = this.actor.requireActor();
        return this.database.transaction.run(async () => {
            const { organization: organizationContext } = await this.authorization.require({
                subject: { kind: 'user', userId },
                permissionCode: workspacePermission.create,
                target: { kind: 'organization', organizationId },
            });
            if (!organizationContext.isOwner)
                throw new OrganizationContextError({ reason: 'forbidden' });

            // A scoped role is shared within the organization, never rebound across tenants.
            let role = await this.permission.findRole({
                organizationId,
                scope: 'WORKSPACE',
                code: 'workspace-manager',
            });
            if (role && (role.archivedAt || !role.permissions.includes(workspacePermission.read)))
                throw new OrganizationContextError({ reason: 'forbidden' });
            if (!role) {
                role = await this.permission.createRole({
                    organizationId,
                    scope: 'WORKSPACE',
                    code: 'workspace-manager',
                    name: 'Workspace manager',
                    permissions: this.managerPermissions,
                });
            }
            const workspace = await this.database.queryClient.workspace.create({
                data: { organizationId, name: input.name, description: input.description ?? null },
                select: { id: true, organizationId: true, name: true, description: true },
            });
            const member = await this.database.queryClient.workspaceMember.create({
                data: {
                    organizationId,
                    workspaceId: workspace.id,
                    organizationMemberId: organizationContext.organizationMemberId,
                },
                select: { id: true },
            });
            await this.permission.bindRole({
                scope: { kind: 'workspace', organizationId, workspaceId: workspace.id },
                memberId: member.id,
                roleId: role.id,
            });
            await this.audit.record({
                organizationId,
                workspaceId: workspace.id,
                actorUserId: userId,
                action: 'workspace.create',
                occurredAt: new Date(),
                requestId: this.actor.get()?.requestId,
                details: { workspaceId: workspace.id, name: workspace.name },
            });
            return { ...workspace, description: workspace.description ?? '' };
        });
    }

    async readContext(organizationId: string, workspaceId: string): Promise<WorkspaceSummary> {
        const { userId } = this.actor.requireActor();
        return this.database.transaction.run(
            async () => {
                const subject = { kind: 'user' as const, userId };
                await this.authorization.require({
                    subject,
                    permissionCode: 'organization.read',
                    target: { kind: 'organization', organizationId },
                });
                await this.authorization.require({
                    subject,
                    permissionCode: workspacePermission.read,
                    target: { kind: 'workspace', organizationId, workspaceId },
                });
                const workspace = await this.database.queryClient.workspace.findUniqueOrThrow({
                    where: { organizationId_id: { organizationId, id: workspaceId } },
                    select: { id: true, organizationId: true, name: true, description: true },
                });
                return { ...workspace, description: workspace.description ?? '' };
            },
            { isolationLevel: 'RepeatableRead' }
        );
    }
}
