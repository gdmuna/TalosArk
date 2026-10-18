import { Injectable } from '@nestjs/common';
import type {
    TeamManagement,
    TeamManagementQuery,
    TeamRoleBody,
    TeamRoleUpdate,
} from '@talos-ark/contracts/team';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationContextKernel } from '@/core/organization-context/index.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { PermissionKernel, type PermissionScope } from '@/core/permission/index.js';
import {
    TeamGovernanceKernel,
    organizationPermission as op,
    workspacePermission as wp,
    type OrganizationGovernancePermission,
} from '@/core/team-governance/index.js';
import { TeamError } from './team.error.js';
import { protectedRoleCodes, TeamOperations } from './team.operations.js';

@Injectable()
export class OrganizationTeamService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly permission: PermissionKernel,
        private readonly authorization: AuthorizationKernel,
        private readonly organization: OrganizationContextKernel,
        private readonly operations: TeamOperations,
        private readonly governance: TeamGovernanceKernel
    ) {}

    target(organizationId: string, workspaceId?: string): PermissionScope {
        return workspaceId
            ? { kind: 'workspace', organizationId, workspaceId }
            : { kind: 'organization', organizationId };
    }

    owner(organizationId: string, permissionCode: OrganizationGovernancePermission): Promise<void> {
        return this.governance.requireOrganizationOwner({
            subject: { kind: 'user', userId: this.operations.actor() },
            organizationId,
            permissionCode,
        });
    }

    async manage(organizationId: string, workspaceId?: string): Promise<boolean> {
        const userId = this.operations.actor();
        const input = { subject: { kind: 'user' as const, userId }, organizationId };
        if (workspaceId)
            return (
                (await this.governance.requireWorkspaceMemberManagement({
                    ...input,
                    workspaceId,
                })) === 'organization'
            );
        await this.governance.requireOrganizationMemberManagement(input);
        return true;
    }

    initialize(organizationId: string): Promise<void> {
        return this.operations.write(organizationId, async () => {
            await this.owner(organizationId, op.read);
            const existing = await this.permission.findRole({
                organizationId,
                scope: 'ORGANIZATION',
                code: 'organization-governance',
            });
            if (existing) return;
            const member = await this.organization.requireMembership(
                this.operations.actor(),
                organizationId
            );
            const role = await this.permission.createRole({
                organizationId,
                code: 'organization-governance',
                name: '组织管理',
                scope: 'ORGANIZATION',
                permissions: [op.members, op.roles, op.invitations],
            });
            await this.permission.bindRole({
                scope: this.target(organizationId),
                memberId: member.organizationMemberId,
                roleId: role.id,
            });
            const manager = await this.permission.findRole({
                organizationId,
                scope: 'WORKSPACE',
                code: 'workspace-manager',
            });
            if (
                manager &&
                !manager.archivedAt &&
                manager.permissions.includes(wp.read) &&
                !manager.permissions.includes(wp.members)
            )
                await this.permission.setRolePermissions({
                    organizationId,
                    roleId: manager.id,
                    permissions: [...manager.permissions, wp.members],
                });
            await this.operations.record(organizationId, 'organization.management.initialize', {
                roleId: role.id,
            });
        });
    }

    snapshot(organizationId: string, query: TeamManagementQuery): Promise<TeamManagement> {
        return this.database.transaction.run(
            async () => {
                const userId = this.operations.actor();
                const governance = await this.governance.readTeam({
                    subject: { kind: 'user', userId },
                    organizationId,
                    workspaceId: query.workspaceId,
                });
                const scope = this.target(organizationId, query.workspaceId);
                const owner = governance.organization.isOwner;
                const organizationManager = governance.canManageOrganizationMembers;
                const canManageMembers = governance.memberVisibility.kind !== 'self';
                const roles =
                    canManageMembers || owner
                        ? await this.database.queryClient.role.findMany({
                              where: {
                                  organizationId,
                                  archivedAt: null,
                                  ...(!owner ? { scope: 'WORKSPACE' as const } : {}),
                              },
                              orderBy: [{ scope: 'asc' }, { code: 'asc' }],
                              select: {
                                  id: true,
                                  code: true,
                                  name: true,
                                  scope: true,
                                  permissions: { select: { permissionCode: true } },
                                  updatedAt: true,
                              },
                          })
                        : [];
                const roleViews = roles.map((role) => ({
                    ...role,
                    permissions: role.permissions.map((item) => item.permissionCode),
                    protected: protectedRoleCodes.has(role.code),
                    grantable:
                        role.scope === (query.workspaceId ? 'WORKSPACE' : 'ORGANIZATION') &&
                        role.code !== 'organization-owner' &&
                        role.code !== 'organization-governance',
                    updatedAt: role.updatedAt.toISOString(),
                }));
                if (!organizationManager) {
                    const permissionCodes = [
                        ...new Set(
                            roleViews
                                .filter((role) => role.grantable)
                                .flatMap((role) => role.permissions)
                        ),
                    ];
                    const decisions = permissionCodes.length
                        ? await this.permission.evaluateMany(
                              permissionCodes.map((permissionCode) => ({
                                  subject: { kind: 'user' as const, userId },
                                  permissionCode,
                                  scope,
                              }))
                          )
                        : [];
                    const allowedPermissions = new Set(
                        permissionCodes.filter((_, index) => decisions[index].allowed)
                    );
                    for (const role of roleViews)
                        role.grantable &&= role.permissions.every((code) =>
                            allowedPermissions.has(code)
                        );
                }
                const search = query.search
                    ? {
                          OR: [
                              {
                                  username: {
                                      contains: query.search,
                                      mode: 'insensitive' as const,
                                  },
                              },
                              { email: { contains: query.search, mode: 'insensitive' as const } },
                          ],
                      }
                    : {};
                const skip = (query.page - 1) * query.pageSize;
                const organizationWhere = {
                    organizationId,
                    ...(canManageMembers ? {} : { userId }),
                    user: search,
                };
                let members: TeamManagement['members'];
                let memberTotal: number;
                if (query.workspaceId) {
                    const where = {
                        organizationId,
                        workspaceId: query.workspaceId,
                        organizationMember: {
                            ...(canManageMembers ? {} : { userId }),
                            user: search,
                        },
                    };
                    memberTotal = await this.database.queryClient.workspaceMember.count({ where });
                    const rows = await this.database.queryClient.workspaceMember.findMany({
                        where,
                        skip,
                        take: query.pageSize,
                        orderBy: { id: 'asc' },
                        select: {
                            id: true,
                            organizationMemberId: true,
                            status: true,
                            organizationMember: {
                                select: {
                                    user: { select: { id: true, username: true, email: true } },
                                },
                            },
                            roleBindings: {
                                where: { role: { archivedAt: null } },
                                select: { role: { select: { id: true, name: true } } },
                            },
                        },
                    });
                    members = rows.map((row) => ({
                        id: row.id,
                        organizationMemberId: row.organizationMemberId,
                        userId: row.organizationMember.user.id,
                        name: row.organizationMember.user.username,
                        email: row.organizationMember.user.email,
                        status: row.status,
                        isOwner: false,
                        roles: row.roleBindings.map((binding) => binding.role),
                    }));
                } else {
                    memberTotal = await this.database.queryClient.organizationMember.count({
                        where: organizationWhere,
                    });
                    const rows = await this.database.queryClient.organizationMember.findMany({
                        where: organizationWhere,
                        skip,
                        take: query.pageSize,
                        orderBy: { id: 'asc' },
                        select: {
                            id: true,
                            status: true,
                            user: { select: { id: true, username: true, email: true } },
                            roleBindings: {
                                where: { role: { archivedAt: null } },
                                select: { role: { select: { id: true, name: true } } },
                            },
                        },
                    });
                    members = rows.map((row) => ({
                        id: row.id,
                        organizationMemberId: row.id,
                        userId: row.user.id,
                        name: row.user.username,
                        email: row.user.email,
                        status: row.status,
                        isOwner: false,
                        roles: row.roleBindings.map((binding) => binding.role),
                    }));
                }
                const org = await this.database.queryClient.organization.findUniqueOrThrow({
                    where: { id: organizationId },
                    select: { ownerUserId: true },
                });
                members = members.map((member) => ({
                    ...member,
                    isOwner: member.userId === org.ownerUserId,
                }));
                const canInvite = governance.canInvite;
                const invitationWhere = {
                    organizationId,
                    ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
                    ...(query.search
                        ? { email: { contains: query.search, mode: 'insensitive' as const } }
                        : {}),
                };
                const invitations = canInvite
                    ? await this.database.queryClient.organizationInvitation.findMany({
                          where: invitationWhere,
                          skip,
                          take: query.pageSize,
                          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                          select: {
                              id: true,
                              email: true,
                              workspaceId: true,
                              workspace: { select: { name: true } },
                              expiresAt: true,
                              acceptedAt: true,
                              revokedAt: true,
                          },
                      })
                    : [];
                const initialized = !!(await this.permission.findRole({
                    organizationId,
                    scope: 'ORGANIZATION',
                    code: 'organization-governance',
                }));
                return {
                    organizationId,
                    workspaceId: query.workspaceId ?? null,
                    isOwner: owner,
                    initialized,
                    canInitialize: owner && !initialized,
                    canManageMembers,
                    canManageRoles: governance.canEditRoleDefinitions,
                    canInvite,
                    members,
                    memberTotal,
                    roles: roleViews,
                    definitions: owner ? [...this.permission.definitions()] : [],
                    invitations: invitations.map((item) => ({
                        id: item.id,
                        email: item.email,
                        workspaceId: item.workspaceId,
                        workspaceName: item.workspace?.name ?? null,
                        expiresAt: item.expiresAt.toISOString(),
                        status: item.acceptedAt
                            ? ('accepted' as const)
                            : item.revokedAt
                              ? ('revoked' as const)
                              : item.expiresAt <= new Date()
                                ? ('expired' as const)
                                : ('pending' as const),
                    })),
                    invitationTotal: canInvite
                        ? await this.database.queryClient.organizationInvitation.count({
                              where: invitationWhere,
                          })
                        : 0,
                    page: query.page,
                    pageSize: query.pageSize,
                };
            },
            { isolationLevel: 'RepeatableRead' }
        );
    }

    addMember(organizationId: string, workspaceId: string, email: string): Promise<void> {
        return this.operations.write(organizationId, async () => {
            const ownerManager = await this.manage(organizationId, workspaceId);
            if (!ownerManager)
                await this.authorization.require({
                    subject: { kind: 'user', userId: this.operations.actor() },
                    permissionCode: wp.read,
                    target: this.target(organizationId, workspaceId),
                });
            const member = await this.database.queryClient.organizationMember.findFirst({
                where: { organizationId, status: 'ACTIVE', user: { email } },
                select: { id: true, userId: true },
            });
            if (!member) throw new TeamError({ reason: 'account-unavailable' });
            await this.joinWorkspace(organizationId, workspaceId, member.id);
            await this.operations.record(
                organizationId,
                'workspace.member.add',
                { userId: member.userId, organizationMemberId: member.id },
                workspaceId
            );
        });
    }

    async joinWorkspace(
        organizationId: string,
        workspaceId: string,
        organizationMemberId: string
    ): Promise<void> {
        const workspace = await this.database.queryClient.workspace.findFirst({
            where: { id: workspaceId, organizationId, archivedAt: null },
            select: { id: true },
        });
        if (!workspace) throw new TeamError({ reason: 'conflict' });
        const existing = await this.database.queryClient.workspaceMember.findUnique({
            where: { workspaceId_organizationMemberId: { workspaceId, organizationMemberId } },
            select: { id: true, status: true },
        });
        if (existing?.status === 'SUSPENDED') throw new TeamError({ reason: 'conflict' });
        if (existing?.status === 'ACTIVE') return;
        if (existing)
            await this.database.queryClient.workspaceRoleBinding.deleteMany({
                where: { workspaceMemberId: existing.id },
            });
        const member = await this.database.queryClient.workspaceMember.upsert({
            where: { workspaceId_organizationMemberId: { workspaceId, organizationMemberId } },
            create: { organizationId, workspaceId, organizationMemberId },
            update: { status: 'ACTIVE', joinedAt: new Date(), leftAt: null },
            select: { id: true },
        });
        await this.bindBasicRole(organizationId, member.id, workspaceId);
    }

    async bindBasicRole(
        organizationId: string,
        memberId: string,
        workspaceId?: string
    ): Promise<void> {
        const code = workspaceId ? 'workspace-member' : 'organization-member';
        const scope = workspaceId ? ('WORKSPACE' as const) : ('ORGANIZATION' as const);
        let role = await this.permission.findRole({ organizationId, scope, code });
        const read = workspaceId ? wp.read : op.read;
        if (role && (role.archivedAt || !role.permissions.includes(read)))
            throw new TeamError({ reason: 'conflict' });
        role ??= await this.permission.createRole({
            organizationId,
            scope,
            code,
            name: workspaceId ? '工作区成员' : '组织成员',
            permissions: [read],
        });
        await this.permission.bindRole({
            scope: this.target(organizationId, workspaceId),
            memberId,
            roleId: role.id,
        });
    }

    setBindings(
        organizationId: string,
        memberId: string,
        roleIds: string[],
        workspaceId?: string
    ): Promise<void> {
        return this.operations.write(organizationId, async () => {
            const ownerManager = await this.manage(organizationId, workspaceId);
            const target = await this.member(organizationId, memberId, workspaceId);
            if (target.status !== 'ACTIVE') throw new TeamError({ reason: 'conflict' });
            const roles = await this.database.queryClient.role.findMany({
                where: {
                    organizationId,
                    id: { in: [...new Set(roleIds)] },
                    archivedAt: null,
                    scope: workspaceId ? 'WORKSPACE' : 'ORGANIZATION',
                },
                select: { id: true, code: true, permissions: { select: { permissionCode: true } } },
            });
            if (
                roles.length !== new Set(roleIds).size ||
                roles.some((role) =>
                    ['organization-owner', 'organization-governance'].includes(role.code)
                )
            )
                throw new TeamError({ reason: 'forbidden' });
            if (!ownerManager) {
                const existing = await this.database.queryClient.workspaceRoleBinding.findMany({
                    where: { organizationId, workspaceId, workspaceMemberId: memberId },
                    select: { roleId: true },
                });
                const retained = new Set(existing.map((binding) => binding.roleId));
                const checks = roles
                    .filter((role) => !retained.has(role.id))
                    .flatMap((role) =>
                        role.permissions.map((value) => ({
                            subject: { kind: 'user' as const, userId: this.operations.actor() },
                            permissionCode: value.permissionCode,
                            scope: this.target(organizationId, workspaceId),
                        }))
                    );
                if ((await this.permission.evaluateMany(checks)).some((value) => !value.allowed))
                    throw new TeamError({ reason: 'forbidden' });
            }
            if (workspaceId)
                await this.database.queryClient.workspaceRoleBinding.deleteMany({
                    where: { organizationId, workspaceId, workspaceMemberId: memberId },
                });
            else
                await this.database.queryClient.organizationRoleBinding.deleteMany({
                    where: { organizationId, organizationMemberId: memberId },
                });
            for (const role of roles)
                await this.permission.bindRole({
                    scope: this.target(organizationId, workspaceId),
                    memberId,
                    roleId: role.id,
                });
            await this.operations.record(
                organizationId,
                'member.roles.replace',
                {
                    memberId,
                    organizationMemberId: target.organizationMemberId,
                    roleIds: roles.map((role) => role.id),
                },
                workspaceId
            );
        });
    }

    removeMember(
        organizationId: string,
        memberId: string,
        workspaceId?: string,
        self = false
    ): Promise<void> {
        return this.operations.write(organizationId, async () => {
            if (!self) await this.manage(organizationId, workspaceId);
            const target = await this.member(organizationId, memberId, workspaceId);
            if (self && target.userId !== this.operations.actor())
                throw new TeamError({ reason: 'forbidden' });
            if (target.status === 'LEFT') return;
            if (workspaceId) {
                await this.database.queryClient.workspaceMember.update({
                    where: { id: memberId },
                    data: { status: 'LEFT', leftAt: new Date() },
                });
                await this.database.queryClient.workspaceRoleBinding.deleteMany({
                    where: { workspaceMemberId: memberId },
                });
            } else {
                await this.database.queryClient.organizationMember.update({
                    where: { id: memberId },
                    data: { status: 'LEFT', leftAt: new Date() },
                });
                const children = await this.database.queryClient.workspaceMember.findMany({
                    where: { organizationMemberId: memberId },
                    select: { id: true },
                });
                await this.database.queryClient.workspaceRoleBinding.deleteMany({
                    where: { workspaceMemberId: { in: children.map((child) => child.id) } },
                });
                await this.database.queryClient.workspaceMember.updateMany({
                    where: { organizationMemberId: memberId },
                    data: { status: 'LEFT', leftAt: new Date() },
                });
                await this.database.queryClient.organizationRoleBinding.deleteMany({
                    where: { organizationMemberId: memberId },
                });
            }
            await this.database.queryClient.organizationInvitation.updateMany({
                where: {
                    organizationId,
                    email: target.email,
                    ...(workspaceId ? { workspaceId } : {}),
                    acceptedAt: null,
                    revokedAt: null,
                },
                data: { revokedAt: new Date() },
            });
            await this.operations.record(
                organizationId,
                self ? 'member.leave' : 'member.remove',
                {
                    memberId,
                    organizationMemberId: target.organizationMemberId,
                    userId: target.userId,
                },
                workspaceId
            );
        });
    }

    async leave(organizationId: string, workspaceId?: string): Promise<void> {
        const membership = await this.organization.requireMembership(
            this.operations.actor(),
            organizationId
        );
        const member = workspaceId
            ? await this.database.queryClient.workspaceMember.findFirst({
                  where: {
                      organizationId,
                      workspaceId,
                      organizationMemberId: membership.organizationMemberId,
                  },
                  select: { id: true },
              })
            : { id: membership.organizationMemberId };
        if (!member) throw new TeamError({ reason: 'forbidden' });
        return this.removeMember(organizationId, member.id, workspaceId, true);
    }

    private async member(organizationId: string, memberId: string, workspaceId?: string) {
        const org = await this.database.queryClient.organization.findUniqueOrThrow({
            where: { id: organizationId },
            select: { ownerUserId: true },
        });
        const organizationMember = workspaceId
            ? await this.database.queryClient.workspaceMember.findFirst({
                  where: { id: memberId, organizationId, workspaceId },
                  select: {
                      status: true,
                      organizationMember: {
                          select: { id: true, userId: true, user: { select: { email: true } } },
                      },
                  },
              })
            : null;
        const member = workspaceId
            ? organizationMember && {
                  ...organizationMember.organizationMember,
                  status: organizationMember.status,
              }
            : await this.database.queryClient.organizationMember.findFirst({
                  where: { id: memberId, organizationId },
                  select: {
                      id: true,
                      userId: true,
                      status: true,
                      user: { select: { email: true } },
                  },
              });
        if (!member) throw new TeamError({ reason: 'forbidden' });
        if (member.userId === org.ownerUserId) throw new TeamError({ reason: 'conflict' });
        return {
            organizationMemberId: member.id,
            userId: member.userId,
            email: member.user.email,
            status: member.status,
        };
    }

    createRole(organizationId: string, body: TeamRoleBody): Promise<void> {
        return this.operations.write(organizationId, async () => {
            await this.owner(organizationId, op.roles);
            if (protectedRoleCodes.has(body.code)) throw new TeamError({ reason: 'conflict' });
            this.validatePermissions(body.permissions, body.scope);
            if (
                await this.permission.findRole({
                    organizationId,
                    scope: body.scope,
                    code: body.code,
                })
            )
                throw new TeamError({ reason: 'conflict' });
            const role = await this.permission.createRole({ organizationId, ...body });
            await this.operations.record(organizationId, 'role.create', {
                roleId: role.id,
                name: role.name,
                permissions: body.permissions,
            });
        });
    }

    updateRole(organizationId: string, roleId: string, body: TeamRoleUpdate | null): Promise<void> {
        return this.operations.write(organizationId, async () => {
            await this.owner(organizationId, op.roles);
            const role = await this.database.queryClient.role.findFirst({
                where: { id: roleId, organizationId, archivedAt: null },
                select: { id: true, code: true, updatedAt: true },
            });
            if (!role || protectedRoleCodes.has(role.code))
                throw new TeamError({ reason: 'conflict' });
            if (body) {
                if (role.updatedAt.toISOString() !== body.expectedUpdatedAt)
                    throw new TeamError({ reason: 'conflict' });
                const definition = await this.database.queryClient.role.findUniqueOrThrow({
                    where: { id: roleId },
                    select: { scope: true },
                });
                this.validatePermissions(body.permissions, definition.scope);
                await this.permission.setRolePermissions({
                    organizationId,
                    roleId,
                    permissions: body.permissions,
                });
                await this.database.queryClient.role.update({
                    where: { id: roleId },
                    data: {
                        name: body.name,
                        updatedAt: new Date(Math.max(Date.now(), role.updatedAt.getTime() + 1)),
                    },
                });
            } else
                await this.database.queryClient.role.update({
                    where: { id: roleId },
                    data: { archivedAt: new Date() },
                });
            await this.operations.record(organizationId, body ? 'role.update' : 'role.archive', {
                roleId,
                ...(body ? { name: body.name, permissions: body.permissions } : {}),
            });
        });
    }

    private validatePermissions(codes: string[], scope: 'ORGANIZATION' | 'WORKSPACE'): void {
        const definitions = this.permission.definitions();
        if (
            codes.some(
                (code) =>
                    !definitions.some(
                        (definition) => definition.code === code && definition.scope === scope
                    )
            )
        )
            throw new TeamError({ reason: 'conflict' });
    }
}
