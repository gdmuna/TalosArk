import { Injectable } from '@nestjs/common';
import type {
    CreateOrganizationBody,
    CreateOrganizationResponse,
    TeamSnapshotResponse,
} from '@talos-ark/contracts/team';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationContextKernel } from '@/core/organization-context/index.js';
import { PermissionKernel } from '@/core/permission/index.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import { WorkspaceService, workspacePermission } from '@/modules/workspace/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { organizationPermission } from '../contribution/organization-authorization.contribution.js';

@Injectable()
export class OrganizationService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly organizationContext: OrganizationContextKernel,
        private readonly permission: PermissionKernel,
        private readonly authorization: AuthorizationKernel,
        private readonly workspace: WorkspaceService,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter
    ) {}

    create(input: CreateOrganizationBody): Promise<CreateOrganizationResponse> {
        const { userId } = this.actor.requireActor();
        return this.database.transaction.run(async () => {
            await this.organizationContext.requireUser(userId);
            const organization = await this.database.queryClient.organization.create({
                data: { name: input.name, ownerUserId: userId },
                select: { id: true, name: true },
            });
            const role = await this.permission.createRole({
                organizationId: organization.id,
                code: 'organization-owner',
                name: 'Organization owner',
                scope: 'ORGANIZATION',
                permissions: [organizationPermission.read, workspacePermission.create],
            });
            const member = await this.database.queryClient.organizationMember.create({
                data: { organizationId: organization.id, userId },
                select: { id: true },
            });
            await this.permission.bindRole({
                scope: { kind: 'organization', organizationId: organization.id },
                memberId: member.id,
                roleId: role.id,
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
                const subject = { kind: 'user' as const, userId };
                const readable = await this.authorization.scope({
                    subject,
                    permissionCode: organizationPermission.read,
                });
                const creatable = await this.authorization.scope({
                    subject,
                    permissionCode: workspacePermission.create,
                });
                const accessible = await this.authorization.scope({
                    subject,
                    permissionCode: workspacePermission.read,
                });
                const readIds =
                    readable.kind === 'organization' ? [...readable.organizationIds] : [];
                const createIds = new Set(
                    creatable.kind === 'organization' ? creatable.organizationIds : []
                );
                const workspaceIds =
                    accessible.kind === 'workspace'
                        ? accessible.workspaces.map((scope) => scope.workspaceId)
                        : [];
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
