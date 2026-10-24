import { Injectable } from '@nestjs/common';
import type {
    WorkspaceDetail,
    WorkspaceUpdate,
    ManagementActivityQuery,
    ManagementActivityPage,
} from '@talos-ark/contracts/team';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { TeamGovernanceKernel } from '@/core/team-governance/index.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { AuditKernel, AuditError } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { WorkspaceManagementError } from './workspace-management.error.js';

@Injectable()
export class WorkspaceManagementService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly governance: TeamGovernanceKernel,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter,
        private readonly writes: OrganizationWriteKernel
    ) {}

    private access(organizationId: string, workspaceId: string) {
        const { userId } = this.actor.requireActor();
        return this.governance.readWorkspace({
            subject: { kind: 'user', userId },
            organizationId,
            workspaceId,
        });
    }

    detail(organizationId: string, workspaceId: string): Promise<WorkspaceDetail> {
        return this.database.transaction.run(
            async () => {
                const access = await this.access(organizationId, workspaceId);
                const workspace = await this.database.queryClient.workspace.findUniqueOrThrow({
                    where: { organizationId_id: { organizationId, id: workspaceId } },
                    select: {
                        id: true,
                        organizationId: true,
                        name: true,
                        description: true,
                        createdAt: true,
                        updatedAt: true,
                        archivedAt: true,
                        organization: { select: { id: true, name: true, ownerUserId: true } },
                    },
                });
                const where = {
                    organizationId,
                    workspaceId,
                    status: 'ACTIVE' as const,
                    organizationMember: { status: 'ACTIVE' as const },
                };
                const memberTotal = access.canViewMembers
                    ? await this.database.queryClient.workspaceMember.count({ where })
                    : null;
                const members = access.canViewMembers
                    ? await this.database.queryClient.workspaceMember.findMany({
                          where,
                          take: 6,
                          orderBy: { id: 'asc' },
                          select: {
                              organizationMember: {
                                  select: {
                                      id: true,
                                      organizationId: true,
                                      userId: true,
                                      status: true,
                                      joinedAt: true,
                                      leftAt: true,
                                      user: { select: { username: true, email: true } },
                                  },
                              },
                          },
                      })
                    : [];
                const bindings = access.canViewMembers
                    ? await this.database.queryClient.workspaceRoleBinding.groupBy({
                          by: ['roleId'],
                          where: {
                              organizationId,
                              workspaceId,
                              member: {
                                  status: 'ACTIVE',
                                  organizationMember: { status: 'ACTIVE' },
                              },
                              role: { archivedAt: null },
                          },
                          _count: { _all: true },
                      })
                    : [];
                return {
                    workspace: {
                        id: workspace.id,
                        organizationId,
                        name: workspace.name,
                        description: workspace.description ?? '',
                        createdAt: workspace.createdAt.toISOString(),
                        updatedAt: workspace.updatedAt.toISOString(),
                        archivedAt: workspace.archivedAt?.toISOString() ?? null,
                    },
                    organization: {
                        id: workspace.organization.id,
                        name: workspace.organization.name,
                    },
                    canUpdate: access.canUpdate,
                    canViewMembers: access.canViewMembers,
                    canReadActivity: access.canReadActivity,
                    memberTotal,
                    members: members.map(({ organizationMember: member }) => ({
                        id: member.id,
                        organizationMemberId: member.id,
                        organizationId,
                        userId: member.userId,
                        name: member.user.username,
                        email: member.user.email,
                        status: member.status,
                        isOwner: member.userId === workspace.organization.ownerUserId,
                        canManageRoles:
                            access.canManageOrganizationMembers &&
                            (member.userId !== workspace.organization.ownerUserId ||
                                access.isSuperAdmin),
                        canRemove:
                            access.canManageOrganizationMembers &&
                            (member.userId !== workspace.organization.ownerUserId ||
                                access.isSuperAdmin),
                        joinedAt: member.joinedAt.toISOString(),
                        leftAt: member.leftAt?.toISOString() ?? null,
                        roles: [],
                    })),
                    roleBindings: Object.fromEntries(
                        bindings.map((binding) => [binding.roleId, binding._count._all])
                    ),
                };
            },
            { isolationLevel: 'RepeatableRead' }
        );
    }

    update(organizationId: string, workspaceId: string, input: WorkspaceUpdate): Promise<void> {
        return this.writes.run({
            organizationId,
            authorize: async () => {
                const access = await this.access(organizationId, workspaceId);
                if (!access.canUpdate) throw new WorkspaceManagementError({ reason: 'forbidden' });
                return access;
            },
            execute: async (access) => {
                const current = await this.database.queryClient.workspace.findUniqueOrThrow({
                    where: { id: workspaceId },
                    select: { updatedAt: true },
                });
                const expected = new Date(input.expectedUpdatedAt);
                const changed = await this.database.queryClient.workspace.updateMany({
                    where: {
                        id: workspaceId,
                        organizationId,
                        archivedAt: null,
                        updatedAt: expected,
                    },
                    data: {
                        name: input.name,
                        description: input.description,
                        updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
                    },
                });
                if (changed.count !== 1) throw new WorkspaceManagementError({ reason: 'conflict' });
                await this.audit.record({
                    organizationId,
                    workspaceId,
                    actorUserId: access.userId,
                    action: 'workspace.update',
                    occurredAt: new Date(),
                    requestId: this.actor.get()?.requestId,
                    details: { workspaceId, name: input.name },
                });
            },
        });
    }

    activity(
        organizationId: string,
        workspaceId: string,
        query: ManagementActivityQuery
    ): Promise<ManagementActivityPage> {
        return this.database.transaction.run(
            async () => {
                const access = await this.access(organizationId, workspaceId);
                if (
                    !access.canReadActivity ||
                    (query.workspaceId && query.workspaceId !== workspaceId)
                )
                    throw new WorkspaceManagementError({ reason: 'forbidden' });
                const workspace = await this.database.queryClient.workspace.findUniqueOrThrow({
                    where: { id: workspaceId },
                    select: { name: true },
                });
                const page = await this.audit
                    .list({
                        scope: { kind: 'workspace', organizationId, workspaceId },
                        actions: [
                            'workspace.create',
                            'workspace.update',
                            'workspace.member.add',
                            'member.roles.replace',
                            'member.remove',
                            'member.leave',
                        ],
                        limit: query.limit,
                        cursor: query.cursor,
                    })
                    .catch((cause) => {
                        if (AuditError.is(cause, 'invalid-cursor'))
                            throw new WorkspaceManagementError(
                                { reason: 'invalid-cursor' },
                                { cause }
                            );
                        throw cause;
                    });
                const users = await this.database.queryClient.user.findMany({
                    where: {
                        id: {
                            in: page.items.flatMap((item) =>
                                item.actorUserId ? [item.actorUserId] : []
                            ),
                        },
                    },
                    select: { id: true, username: true },
                });
                const names = new Map(users.map((user) => [user.id, user.username]));
                return {
                    items: page.items.map((item) => ({
                        id: item.id,
                        actorName: item.actorUserId
                            ? (names.get(item.actorUserId) ?? '已注销账户')
                            : '系统',
                        action: item.action,
                        subjectName: workspace.name,
                        occurredAt: item.occurredAt.toISOString(),
                    })),
                    nextCursor: page.nextCursor,
                };
            },
            { isolationLevel: 'RepeatableRead' }
        );
    }
}
