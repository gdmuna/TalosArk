import { Injectable } from '@nestjs/common';
import type {
    CreateOrganizationBody,
    CreateOrganizationResponse,
    TeamSnapshotResponse,
} from '@talos-ark/contracts/team';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { TenantKernel } from '@/core/tenant/index.js';
import { PermissionKernel } from '@/core/permission/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import {
    WorkspaceService,
    workspacePermission,
    workspaceCreateAuthorization,
} from '@/modules/workspace/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import {
    organizationPermission,
    organizationReadAuthorization,
} from '../contribution/organization-authorization.contribution.js';

@Injectable()
export class OrganizationService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly tenant: TenantKernel,
        private readonly permission: PermissionKernel,
        private readonly workspace: WorkspaceService,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter
    ) {}

    create(input: CreateOrganizationBody): Promise<CreateOrganizationResponse> {
        const { userId } = this.actor.requireActor();
        return this.database.transaction.run(async () => {
            await this.tenant.requireUser(userId);
            const organization = await this.database.queryClient.organization.create({
                data: { name: input.name, ownerUserId: userId },
                select: { id: true, name: true },
            });
            await this.database.queryClient.permission.createMany({
                data: [
                    { code: organizationPermission.read, name: organizationReadAuthorization.name },
                    { code: workspacePermission.create, name: workspaceCreateAuthorization.name },
                ],
                skipDuplicates: true,
            });
            const role = await this.database.queryClient.role.create({
                data: {
                    organizationId: organization.id,
                    code: 'organization-owner',
                    name: 'Organization owner',
                    scope: 'ORGANIZATION',
                    permissions: {
                        create: [
                            { permissionCode: organizationPermission.read },
                            { permissionCode: workspacePermission.create },
                        ],
                    },
                },
                select: { id: true },
            });
            const member = await this.database.queryClient.organizationMember.create({
                data: { organizationId: organization.id, userId },
                select: { id: true },
            });
            await this.database.queryClient.organizationRoleBinding.create({
                data: {
                    organizationId: organization.id,
                    organizationMemberId: member.id,
                    roleId: role.id,
                },
            });
            await this.audit.record({
                organizationId: organization.id,
                actorUserId: userId,
                action: 'organization.create',
                occurredAt: new Date(),
                requestId: this.actor.get()?.requestId,
                details: { organizationId: organization.id, name: organization.name },
            });
            const workspace = await this.workspace.create(organization.id, {
                name: input.workspaceName,
            });
            return { organization: { ...organization, canCreateWorkspace: true }, workspace };
        });
    }

    snapshot(): Promise<TeamSnapshotResponse> {
        const { userId } = this.actor.requireActor();
        return this.database.transaction.run(
            async () => {
                const readIds = await this.permission.organizationIds(
                    userId,
                    organizationPermission.read
                );
                const createIds = new Set(
                    await this.permission.organizationIds(userId, workspacePermission.create)
                );
                const workspaceIds = await this.permission.workspaceIds(
                    userId,
                    workspacePermission.read
                );
                const organizations = await this.database.queryClient.organization.findMany({
                    where: { id: { in: readIds } },
                    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                    select: { id: true, name: true, ownerUserId: true },
                });
                const workspaces = await this.database.queryClient.workspace.findMany({
                    where: { id: { in: workspaceIds }, organizationId: { in: readIds } },
                    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                    select: { id: true, organizationId: true, name: true, description: true },
                });
                return {
                    organizations: organizations.map(({ id, name, ownerUserId }) => ({
                        id,
                        name,
                        canCreateWorkspace: ownerUserId === userId && createIds.has(id),
                    })),
                    workspaces: workspaces.map((workspace) => ({
                        ...workspace,
                        description: workspace.description ?? '',
                    })),
                };
            },
            { isolationLevel: 'RepeatableRead' }
        );
    }
}
