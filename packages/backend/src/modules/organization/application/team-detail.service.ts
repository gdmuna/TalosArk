import { Injectable } from '@nestjs/common';
import type { Prisma } from '@root/prisma/generated/client.js';
import type {
    ManagementPageQuery,
    ManagementRoleQuery,
    ManagementActivityQuery,
    MemberDetail,
    RoleDetail,
    MemberWorkspacePage,
    RoleBindingPage,
    ManagementRolePage,
    ManagementMemberPage,
    ManagementActivityPage,
} from '@talos-ark/contracts/team';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { PermissionKernel } from '@/core/permission/index.js';
import { AuditKernel, AuditError, type AuditListInput } from '@/core/audit/index.js';
import { TeamGovernanceKernel, workspacePermission as wp } from '@/core/team-governance/index.js';
import { TeamOperations, protectedRoleCodes } from './team.operations.js';
import { TeamError } from './team.error.js';
import {
    managementMemberSelect,
    managementRoleSelect,
    managementWorkspaceSelect,
    memberDetailView,
    roleDetailView,
    workspaceDetailView,
} from './team-detail.projection.js';

@Injectable()
export class TeamDetailService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly governance: TeamGovernanceKernel,
        private readonly permission: PermissionKernel,
        private readonly operations: TeamOperations,
        private readonly audit: AuditKernel
    ) {}

    private read<T>(work: () => Promise<T>): Promise<T> {
        return this.database.transaction.run(
            work,
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }

    private async access(organizationId: string, workspaceId?: string) {
        const userId = this.operations.actor();
        const subject = { kind: 'user' as const, userId };
        const governance = await this.governance.readTeam({ subject, organizationId, workspaceId });
        const org = await this.database.queryClient.organization.findUniqueOrThrow({
            where: { id: organizationId },
            select: { id: true, name: true, ownerUserId: true },
        });
        return {
            userId,
            subject,
            org,
            owner: governance.organization.isOwner || governance.organization.isSuperAdmin,
            isSuperAdmin: governance.organization.isSuperAdmin,
            canManageMembers: governance.canManageOrganizationMembers,
            canManageRoles: governance.canEditRoleDefinitions,
            workspaceManager: governance.memberVisibility.kind === 'workspace',
            workspaceId,
        };
    }

    private async memberContext(organizationId: string, memberId: string, workspaceId?: string) {
        const access = await this.access(organizationId, workspaceId);
        const row = await this.database.queryClient.organizationMember.findFirst({
            where: { id: memberId, organizationId },
            select: managementMemberSelect,
        });
        if (!row) throw new TeamError({ reason: 'forbidden' });
        const self = row.userId === access.userId;
        if (!self && !access.canManageMembers) {
            if (
                !access.workspaceManager ||
                !workspaceId ||
                !(await this.database.queryClient.workspaceMember.findFirst({
                    where: { organizationId, workspaceId, organizationMemberId: memberId },
                    select: { id: true },
                }))
            )
                throw new TeamError({ reason: 'forbidden' });
        }
        return { ...access, row, self };
    }

    member(
        organizationId: string,
        memberId: string,
        query: { workspaceId?: string }
    ): Promise<MemberDetail> {
        return this.read(async () => {
            const context = await this.memberContext(organizationId, memberId, query.workspaceId);
            const includeRoles = context.self || context.canManageMembers;
            const roles = includeRoles
                ? await this.database.queryClient.role.findMany({
                      where: {
                          organizationId,
                          archivedAt: null,
                          organizationBindings: { some: { organizationMemberId: memberId } },
                      },
                      select: managementRoleSelect,
                      orderBy: { id: 'asc' },
                  })
                : [];
            const member = memberDetailView(
                context.row,
                context.org.ownerUserId,
                includeRoles,
                context
            );
            return {
                organization: { id: context.org.id, name: context.org.name },
                member,
                roles: roles.map((role) => roleDetailView(role, protectedRoleCodes, context)),
                definitions: [...this.permission.definitions()],
                canManageRoles: member.canManageRoles,
                canReadOrganizationRoles: includeRoles,
                canReadActivity:
                    context.self || context.canManageMembers || context.workspaceManager,
            };
        });
    }

    members(organizationId: string, query: ManagementPageQuery): Promise<ManagementMemberPage> {
        return this.read(async () => {
            const access = await this.access(organizationId, query.workspaceId);
            const where: Prisma.OrganizationMemberWhereInput = {
                organizationId,
                ...(!access.canManageMembers && !access.workspaceManager
                    ? { userId: access.userId }
                    : {}),
                ...(query.workspaceId
                    ? { workspaces: { some: { workspaceId: query.workspaceId } } }
                    : {}),
                ...(query.search
                    ? {
                          user: {
                              OR: [
                                  { username: { contains: query.search, mode: 'insensitive' } },
                                  { email: { contains: query.search, mode: 'insensitive' } },
                              ],
                          },
                      }
                    : {}),
            };
            const total = await this.database.queryClient.organizationMember.count({ where });
            const rows = await this.database.queryClient.organizationMember.findMany({
                where,
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                orderBy: { id: 'asc' },
                select: managementMemberSelect,
            });
            return {
                items: rows.map((row) =>
                    memberDetailView(
                        row,
                        access.org.ownerUserId,
                        access.canManageMembers || row.userId === access.userId,
                        access
                    )
                ),
                total,
                page: query.page,
                pageSize: query.pageSize,
            };
        });
    }

    memberWorkspaces(
        organizationId: string,
        memberId: string,
        query: ManagementPageQuery
    ): Promise<MemberWorkspacePage> {
        return this.read(async () => {
            const context = await this.memberContext(organizationId, memberId, query.workspaceId);
            const allowed = context.canManageMembers
                ? undefined
                : context.self
                  ? (
                        await this.permission.scopes({
                            subject: context.subject,
                            permissionCode: wp.read,
                            within: { kind: 'organization', organizationId },
                        })
                    ).flatMap((scope) => (scope.kind === 'workspace' ? [scope.workspaceId] : []))
                  : query.workspaceId
                    ? [query.workspaceId]
                    : [];
            const where: Prisma.WorkspaceMemberWhereInput = {
                organizationId,
                organizationMemberId: memberId,
                AND: [
                    ...(allowed ? [{ workspaceId: { in: allowed } }] : []),
                    ...(query.workspaceId ? [{ workspaceId: query.workspaceId }] : []),
                ],
                workspace: {
                    archivedAt: null,
                    ...(query.search
                        ? { name: { contains: query.search, mode: 'insensitive' } }
                        : {}),
                },
            };
            const total = await this.database.queryClient.workspaceMember.count({ where });
            const rows = await this.database.queryClient.workspaceMember.findMany({
                where,
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                orderBy: { id: 'asc' },
                select: {
                    id: true,
                    organizationId: true,
                    workspaceId: true,
                    organizationMemberId: true,
                    status: true,
                    joinedAt: true,
                    leftAt: true,
                    workspace: { select: managementWorkspaceSelect },
                    roleBindings: {
                        where: { role: { archivedAt: null } },
                        select: { role: { select: managementRoleSelect } },
                    },
                },
            });
            return {
                items: rows.map((row) => ({
                    id: row.id,
                    organizationId: row.organizationId,
                    workspaceId: row.workspaceId,
                    organizationMemberId: row.organizationMemberId,
                    status: row.status,
                    joinedAt: row.joinedAt.toISOString(),
                    leftAt: row.leftAt?.toISOString() ?? null,
                    workspace: workspaceDetailView(row.workspace),
                    roles: row.roleBindings.map((binding) =>
                        roleDetailView(binding.role, protectedRoleCodes, context)
                    ),
                })),
                total,
                page: query.page,
                pageSize: query.pageSize,
            };
        });
    }

    private async roleContext(organizationId: string, roleId: string, workspaceId?: string) {
        const access = await this.access(organizationId, workspaceId);
        const role = await this.database.queryClient.role.findFirst({
            where: { id: roleId, organizationId, archivedAt: null },
            select: managementRoleSelect,
        });
        if (!role) throw new TeamError({ reason: 'forbidden' });
        if (!access.owner && !(access.workspaceManager && role.scope === 'WORKSPACE')) {
            const assigned =
                role.scope === 'ORGANIZATION'
                    ? await this.database.queryClient.organizationRoleBinding.findFirst({
                          where: {
                              organizationId,
                              roleId,
                              member: { userId: access.userId, status: 'ACTIVE' },
                          },
                          select: { roleId: true },
                      })
                    : workspaceId &&
                      (await this.database.queryClient.workspaceRoleBinding.findFirst({
                          where: {
                              organizationId,
                              roleId,
                              workspaceId,
                              member: {
                                  status: 'ACTIVE',
                                  organizationMember: { userId: access.userId, status: 'ACTIVE' },
                              },
                          },
                          select: { roleId: true },
                      }));
            if (!assigned) throw new TeamError({ reason: 'forbidden' });
        }
        return {
            ...access,
            role,
            canReadBindings:
                access.canManageMembers ||
                access.canManageRoles ||
                (access.workspaceManager && role.scope === 'WORKSPACE'),
        };
    }

    role(
        organizationId: string,
        roleId: string,
        query: { workspaceId?: string }
    ): Promise<RoleDetail> {
        return this.read(async () => {
            const context = await this.roleContext(organizationId, roleId, query.workspaceId);
            const bindingTotal = !context.canReadBindings
                ? null
                : context.role.scope === 'ORGANIZATION'
                  ? await this.database.queryClient.organizationRoleBinding.count({
                        where: { organizationId, roleId, member: { status: 'ACTIVE' } },
                    })
                  : await this.database.queryClient.workspaceRoleBinding.count({
                        where: {
                            organizationId,
                            roleId,
                            ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
                            member: {
                                status: 'ACTIVE',
                                organizationMember: { status: 'ACTIVE' },
                                workspace: { archivedAt: null },
                            },
                        },
                    });
            return {
                organization: { id: context.org.id, name: context.org.name },
                role: roleDetailView(context.role, protectedRoleCodes, context),
                definitions: [...this.permission.definitions()].filter(
                    (item) => item.scope === context.role.scope
                ),
                canEdit:
                    context.canManageRoles &&
                    (!protectedRoleCodes.has(context.role.code) || context.isSuperAdmin),
                canReadBindings: context.canReadBindings,
                canReadActivity: context.canManageRoles,
                bindingTotal,
            };
        });
    }

    roles(organizationId: string, query: ManagementRoleQuery): Promise<ManagementRolePage> {
        return this.read(async () => {
            const context = await this.access(organizationId, query.workspaceId);
            const scope = context.owner
                ? query.scope
                : context.workspaceManager
                  ? 'WORKSPACE'
                  : query.scope;
            if (context.workspaceManager && query.scope === 'ORGANIZATION')
                throw new TeamError({ reason: 'forbidden' });
            const where: Prisma.RoleWhereInput = {
                organizationId,
                archivedAt: null,
                ...(scope ? { scope } : {}),
                ...(!context.owner && !context.workspaceManager
                    ? {
                          OR: [
                              {
                                  organizationBindings: {
                                      some: {
                                          member: { userId: context.userId, status: 'ACTIVE' },
                                      },
                                  },
                              },
                              ...(query.workspaceId
                                  ? [
                                        {
                                            workspaceBindings: {
                                                some: {
                                                    workspaceId: query.workspaceId,
                                                    member: {
                                                        status: 'ACTIVE' as const,
                                                        organizationMember: {
                                                            userId: context.userId,
                                                            status: 'ACTIVE' as const,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    ]
                                  : []),
                          ],
                      }
                    : {}),
                ...(query.search
                    ? {
                          AND: [
                              {
                                  OR: [
                                      { name: { contains: query.search, mode: 'insensitive' } },
                                      { code: { contains: query.search, mode: 'insensitive' } },
                                  ],
                              },
                          ],
                      }
                    : {}),
            };
            const total = await this.database.queryClient.role.count({ where });
            const rows = await this.database.queryClient.role.findMany({
                where,
                select: managementRoleSelect,
                orderBy: { id: 'asc' },
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            });
            return {
                items: rows.map((row) => roleDetailView(row, protectedRoleCodes, context)),
                total,
                page: query.page,
                pageSize: query.pageSize,
            };
        });
    }

    bindings(
        organizationId: string,
        roleId: string,
        query: ManagementPageQuery
    ): Promise<RoleBindingPage> {
        return this.read(async () => {
            const context = await this.roleContext(organizationId, roleId, query.workspaceId);
            if (!context.canReadBindings) throw new TeamError({ reason: 'forbidden' });
            const user = query.search
                ? {
                      OR: [
                          { username: { contains: query.search, mode: 'insensitive' as const } },
                          { email: { contains: query.search, mode: 'insensitive' as const } },
                      ],
                  }
                : {};
            const paging = { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
            if (context.role.scope === 'ORGANIZATION') {
                const where = {
                    organizationId,
                    roleId,
                    member: { status: 'ACTIVE' as const, user },
                };
                const total = await this.database.queryClient.organizationRoleBinding.count({
                    where,
                });
                const rows = await this.database.queryClient.organizationRoleBinding.findMany({
                    where,
                    ...paging,
                    orderBy: { organizationMemberId: 'asc' },
                    select: { createdAt: true, member: { select: managementMemberSelect } },
                });
                return {
                    items: rows.map((row) => ({
                        id: row.member.id,
                        member: memberDetailView(
                            row.member,
                            context.org.ownerUserId,
                            true,
                            context
                        ),
                        workspace: null,
                        createdAt: row.createdAt.toISOString(),
                    })),
                    total,
                    page: query.page,
                    pageSize: query.pageSize,
                };
            }
            const where = {
                organizationId,
                roleId,
                ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
                member: {
                    status: 'ACTIVE' as const,
                    workspace: { archivedAt: null },
                    organizationMember: { status: 'ACTIVE' as const, user },
                },
            };
            const total = await this.database.queryClient.workspaceRoleBinding.count({ where });
            const rows = await this.database.queryClient.workspaceRoleBinding.findMany({
                where,
                ...paging,
                orderBy: [{ workspaceId: 'asc' }, { workspaceMemberId: 'asc' }],
                select: {
                    createdAt: true,
                    member: {
                        select: {
                            organizationMember: { select: managementMemberSelect },
                            workspace: { select: managementWorkspaceSelect },
                        },
                    },
                },
            });
            return {
                items: rows.map((row) => ({
                    id: `${row.member.organizationMember.id}:${row.member.workspace.id}`,
                    member: memberDetailView(
                        row.member.organizationMember,
                        context.org.ownerUserId,
                        context.canManageMembers,
                        context
                    ),
                    workspace: workspaceDetailView(row.member.workspace),
                    createdAt: row.createdAt.toISOString(),
                })),
                total,
                page: query.page,
                pageSize: query.pageSize,
            };
        });
    }

    private async activity(
        input: AuditListInput,
        subjectName: string
    ): Promise<ManagementActivityPage> {
        const page = await this.audit.list(input).catch((cause) => {
            if (AuditError.is(cause, 'invalid-cursor'))
                throw new TeamError({ reason: 'invalid-cursor' }, { cause });
            throw cause;
        });
        const users = await this.database.queryClient.user.findMany({
            where: {
                id: {
                    in: page.items.flatMap((item) => (item.actorUserId ? [item.actorUserId] : [])),
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
                subjectName,
                occurredAt: item.occurredAt.toISOString(),
            })),
            nextCursor: page.nextCursor,
        };
    }

    memberActivity(
        organizationId: string,
        memberId: string,
        query: ManagementActivityQuery
    ): Promise<ManagementActivityPage> {
        return this.read(async () => {
            const context = await this.memberContext(organizationId, memberId, query.workspaceId);
            return this.activity(
                {
                    scope: query.workspaceId
                        ? { kind: 'workspace', organizationId, workspaceId: query.workspaceId }
                        : { kind: 'organization', organizationId },
                    actions: [
                        'workspace.member.add',
                        'member.roles.replace',
                        'member.leave',
                        'member.remove',
                    ],
                    detailsMatch: { field: 'organizationMemberId', value: memberId },
                    limit: query.limit,
                    cursor: query.cursor,
                },
                context.row.user.username
            );
        });
    }

    roleActivity(
        organizationId: string,
        roleId: string,
        query: ManagementActivityQuery
    ): Promise<ManagementActivityPage> {
        return this.read(async () => {
            const context = await this.roleContext(organizationId, roleId, query.workspaceId);
            if (!context.canManageRoles) throw new TeamError({ reason: 'forbidden' });
            return this.activity(
                {
                    scope: { kind: 'organization', organizationId },
                    actions: ['role.create', 'role.update', 'role.archive'],
                    detailsMatch: { field: 'roleId', value: roleId },
                    limit: query.limit,
                    cursor: query.cursor,
                },
                context.role.name
            );
        });
    }
}
