import { Injectable } from '@nestjs/common';
import type { CreateWorkspaceBody, WorkspaceSummary } from '@talos-ark/contracts/team';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { TenantKernel, TenantError } from '@/core/tenant/index.js';
import { AuthorizationExtension, PermissionKernel } from '@/core/permission/index.js';
import { WorkspaceContextKernel } from '@/core/workspace/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';

import {
    workspaceAuthorization,
    workspacePermission,
    workspaceReadAuthorization,
} from '../contribution/workspace-authorization.contribution.js';

export { workspacePermission } from '../contribution/workspace-authorization.contribution.js';

@Injectable()
@AuthorizationExtension(workspaceAuthorization)
export class WorkspaceService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly tenant: TenantKernel,
        private readonly permission: PermissionKernel,
        private readonly context: WorkspaceContextKernel,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter
    ) {}

    create(organizationId: string, input: CreateWorkspaceBody): Promise<WorkspaceSummary> {
        const { userId } = this.actor.requireActor();
        return this.database.transaction.run(async () => {
            const tenant = await this.tenant.requireMembership(userId, organizationId);
            const allowed = await this.permission.organizationIds(
                userId,
                workspacePermission.create
            );
            if (!tenant.isOwner || !allowed.includes(organizationId))
                throw new TenantError({ reason: 'forbidden' });

            // A scoped role is shared within the organization, never rebound across tenants.
            let role = await this.database.queryClient.role.findUnique({
                where: {
                    organizationId_scope_code: {
                        organizationId,
                        scope: 'WORKSPACE',
                        code: 'workspace-manager',
                    },
                },
                select: {
                    id: true,
                    archivedAt: true,
                    permissions: {
                        where: { permissionCode: workspacePermission.read },
                        select: { permissionCode: true },
                    },
                },
            });
            if (role && (role.archivedAt || !role.permissions.length))
                throw new TenantError({ reason: 'forbidden' });
            if (!role) {
                await this.database.queryClient.permission.upsert({
                    where: { code: workspacePermission.read },
                    update: {},
                    create: {
                        code: workspacePermission.read,
                        name: workspaceReadAuthorization.name,
                    },
                });
                role = await this.database.queryClient.role.create({
                    data: {
                        organizationId,
                        scope: 'WORKSPACE',
                        code: 'workspace-manager',
                        name: 'Workspace manager',
                        permissions: { create: { permissionCode: workspacePermission.read } },
                    },
                    select: {
                        id: true,
                        archivedAt: true,
                        permissions: {
                            where: { permissionCode: workspacePermission.read },
                            select: { permissionCode: true },
                        },
                    },
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
                    organizationMemberId: tenant.organizationMemberId,
                },
                select: { id: true },
            });
            await this.database.queryClient.workspaceRoleBinding.create({
                data: {
                    organizationId,
                    workspaceId: workspace.id,
                    workspaceMemberId: member.id,
                    roleId: role.id,
                },
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
                await this.context.requireContext(
                    userId,
                    organizationId,
                    workspaceId,
                    workspacePermission.read
                );
                if (
                    !(await this.permission.organizationIds(userId, 'organization.read')).includes(
                        organizationId
                    )
                )
                    throw new TenantError({ reason: 'forbidden' });
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
