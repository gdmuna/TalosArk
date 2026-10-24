import type { TeamInvitation, TeamMember } from '@talos-ark/contracts/team';
import {
    TeamNameSchema,
    TeamRoleBodySchema,
    TeamRoleUpdateSchema,
} from '@talos-ark/contracts/team';
import { ManagementDetailUnavailableError, type ManagementDetailSource } from './source';
import { createDetailFixture, detailId } from './fixture';

export function createManagementDetailMock(): ManagementDetailSource {
    const data = createDetailFixture();
    const invitations: (TeamInvitation & { organizationId: string })[] = [
        {
            id: detailId(701),
            organizationId: detailId(1),
            email: 'pending@example.test',
            workspaceId: detailId(11),
            workspaceName: '王教授课题组',
            expiresAt: '2027-01-01T00:00:00.000Z',
            status: 'pending',
        },
    ];
    let sequence = 1000;
    const nextId = () => detailId(++sequence);
    const copy = <T>(value: T, signal?: AbortSignal): T => {
        signal?.throwIfAborted();
        return structuredClone(value);
    };
    function requireValue<T>(value: T | undefined): T {
        if (!value)
            throw new ManagementDetailUnavailableError('该模拟对象不存在，或不属于当前组织');
        return value;
    }
    const organization = (id: string) =>
        requireValue(data.organizations.find((item) => item.id === id));
    function workspace(id: string) {
        return requireValue(data.workspaces.find((item) => item.id === id));
    }
    function member(organizationId: string, id: string) {
        organization(organizationId);
        return requireValue(
            data.members.find((item) => item.organizationId === organizationId && item.id === id)
        );
    }
    function role(organizationId: string, id: string) {
        organization(organizationId);
        return requireValue(
            data.roles.find(
                (item) =>
                    item.organizationId === organizationId && item.id === id && !item.archivedAt
            )
        );
    }
    const manageable = (organizationId: string) => organizationId === detailId(1);
    const activeRoles = (organizationId: string) =>
        data.roles.filter((item) => item.organizationId === organizationId && !item.archivedAt);
    function record(
        organizationId: string,
        workspaceId: string | null,
        action: string,
        subjectId: string,
        subjectName: string
    ) {
        data.activities.unshift({
            id: nextId(),
            organizationId,
            workspaceId,
            actorUserId: detailId(201),
            actorName: '王教授',
            action,
            subjectId,
            subjectName,
            occurredAt: new Date().toISOString(),
        });
    }
    const source: ManagementDetailSource = {
        async catalog(signal) {
            return copy(data, signal);
        },
        async workspace(id, signal) {
            const current = workspace(id);
            const resources = data.resources.filter((item) => item.workspaceId === id);
            const starts = ['2026-09-19', '2026-09-26', '2026-10-03', '2026-10-10'];
            const points = starts.map((start) => {
                const from = Date.parse(start + 'T00:00:00.000Z'),
                    to = from + 7 * 86400000;
                return {
                    label: start.slice(5).replace('-', '/'),
                    count: resources.filter(
                        (item) =>
                            Date.parse(item.createdAt) >= from && Date.parse(item.createdAt) < to
                    ).length,
                };
            });
            const memberships = data.workspaceMembers.filter(
                (item) =>
                    item.workspaceId === id &&
                    item.organizationId === current.organizationId &&
                    item.status === 'ACTIVE'
            );
            return copy(
                {
                    canUpdate: manageable(current.organizationId) && !current.archivedAt,
                    workspace: current,
                    organization: organization(current.organizationId),
                    memberships,
                    members: memberships.map((item) =>
                        member(current.organizationId, item.organizationMemberId)
                    ),
                    roles: activeRoles(current.organizationId).filter(
                        (item) => item.scope === 'WORKSPACE'
                    ),
                    roleBindings: Object.fromEntries(
                        activeRoles(current.organizationId)
                            .filter((item) => item.scope === 'WORKSPACE')
                            .map((role) => [
                                role.id,
                                memberships.filter((item) => item.roleIds.includes(role.id)).length,
                            ])
                    ),
                    resources,
                    resourceCreations: { from: starts[0] ?? '', to: '2026-10-16', points },
                    outgoingAccess: data.facilityAccess.filter(
                        (item) => item.managementWorkspaceId === id
                    ),
                    incomingAccess: data.facilityAccess.filter((item) => item.workspaceId === id),
                    activities: data.activities.filter((item) => item.workspaceId === id),
                },
                signal
            );
        },
        async member(organizationId, id, signal) {
            const current = member(organizationId, id);
            return copy(
                {
                    canManageRoles:
                        manageable(organizationId) &&
                        !current.isOwner &&
                        current.status === 'ACTIVE',
                    member: current,
                    organization: organization(organizationId),
                    roles: activeRoles(organizationId).filter((item) =>
                        current.roles.some((binding) => binding.id === item.id)
                    ),
                    workspaces: data.workspaceMembers
                        .filter(
                            (item) =>
                                item.organizationId === organizationId &&
                                item.organizationMemberId === id
                        )
                        .map((item) => ({
                            ...item,
                            workspace: workspace(item.workspaceId),
                            roles: activeRoles(organizationId).filter((role) =>
                                item.roleIds.includes(role.id)
                            ),
                        })),
                    activities: data.activities.filter(
                        (item) =>
                            item.organizationId === organizationId &&
                            (item.actorUserId === current.userId || item.subjectId === id)
                    ),
                },
                signal
            );
        },
        async role(organizationId, id, signal) {
            const current = role(organizationId, id);
            const bindings =
                current.scope === 'ORGANIZATION'
                    ? data.members
                          .filter(
                              (item) =>
                                  item.organizationId === organizationId &&
                                  item.status === 'ACTIVE' &&
                                  item.roles.some((role) => role.id === id)
                          )
                          .map((item) => ({
                              member: item,
                              workspace: null,
                              joinedAt: item.joinedAt,
                          }))
                    : data.workspaceMembers
                          .filter(
                              (item) =>
                                  item.organizationId === organizationId &&
                                  item.status === 'ACTIVE' &&
                                  item.roleIds.includes(id)
                          )
                          .map((item) => ({
                              member: member(organizationId, item.organizationMemberId),
                              workspace: workspace(item.workspaceId),
                              joinedAt: item.joinedAt,
                          }));
            return copy(
                {
                    canEdit: manageable(organizationId) && !current.protected,
                    role: current,
                    organization: organization(organizationId),
                    definitions: data.definitions.filter((item) => item.scope === current.scope),
                    bindings,
                    activities: data.activities.filter(
                        (item) => item.organizationId === organizationId && item.subjectId === id
                    ),
                },
                signal
            );
        },
        async updateWorkspace(id, patch, signal) {
            signal?.throwIfAborted();
            const current = workspace(id);
            if (!manageable(current.organizationId) || current.archivedAt)
                throw new Error('此模拟身份没有编辑权限');
            const parsedName = TeamNameSchema.safeParse(patch.name);
            if (!parsedName.success || patch.description.length > 500)
                throw new Error('名称为 1–40 字，说明不超过 500 字');
            const name = parsedName.data;
            current.name = name;
            current.description = patch.description.trim();
            current.updatedAt = new Date().toISOString();
            record(current.organizationId, id, '更新工作区资料', id, name);
        },
        team: {
            async load(selection, query, signal) {
                const org = organization(selection.organizationId);
                if (
                    selection.workspaceId &&
                    workspace(selection.workspaceId).organizationId !== org.id
                )
                    throw new Error('工作区不属于当前组织');
                const text = query.search.trim().toLocaleLowerCase();
                let members: TeamMember[] = data.members
                    .filter((item) => item.organizationId === org.id && item.status !== 'LEFT')
                    .map((item) => ({
                        ...item,
                        roles: activeRoles(org.id)
                            .filter((role) => item.roles.some((binding) => binding.id === role.id))
                            .map((role) => ({ id: role.id, name: role.name })),
                    }));
                if (selection.workspaceId)
                    members = data.workspaceMembers
                        .filter(
                            (item) =>
                                item.organizationId === org.id &&
                                item.workspaceId === selection.workspaceId &&
                                item.status !== 'LEFT'
                        )
                        .map((item) => ({
                            ...member(org.id, item.organizationMemberId),
                            id: item.id,
                            status: item.status,
                            roles: activeRoles(org.id)
                                .filter((role) => item.roleIds.includes(role.id))
                                .map((role) => ({ id: role.id, name: role.name })),
                        }));
                members = members.filter((item) =>
                    `${item.name} ${item.email}`.toLocaleLowerCase().includes(text)
                );
                const invites = invitations.filter(
                    (item) =>
                        item.organizationId === org.id &&
                        (!selection.workspaceId || item.workspaceId === selection.workspaceId) &&
                        item.email.toLocaleLowerCase().includes(text)
                );
                const start = (query.page - 1) * query.pageSize;
                const canManage = manageable(org.id);
                return copy(
                    {
                        organizationId: org.id,
                        workspaceId: selection.workspaceId ?? null,
                        isOwner: canManage,
                        initialized: true,
                        canInitialize: false,
                        canManageMembers: canManage,
                        canManageRoles: canManage,
                        canInvite: canManage,
                        members: members.slice(start, start + query.pageSize),
                        memberTotal: members.length,
                        invitations: invites.slice(start, start + query.pageSize),
                        invitationTotal: invites.length,
                        roles: activeRoles(org.id),
                        definitions: data.definitions,
                        page: query.page,
                        pageSize: query.pageSize,
                    },
                    signal
                );
            },
            async mutate(selection, command, signal) {
                signal.throwIfAborted();
                organization(selection.organizationId);
                if (
                    selection.workspaceId &&
                    workspace(selection.workspaceId).organizationId !== selection.organizationId
                )
                    throw new Error('工作区不属于当前组织');
                if (!manageable(selection.organizationId))
                    throw new Error('此模拟身份没有编辑权限');
                if (command.kind === 'create-role') {
                    const parsed = TeamRoleBodySchema.safeParse(command.role);
                    if (!parsed.success) throw new Error('角色名称、标识或权限格式无效');
                    const body = parsed.data;
                    if (
                        activeRoles(selection.organizationId).some(
                            (item) =>
                                item.scope === command.role.scope && item.code === command.role.code
                        )
                    )
                        throw new Error('角色标识已存在');
                    if (
                        command.role.permissions.some(
                            (code) =>
                                !data.definitions.some(
                                    (item) =>
                                        item.code === code && item.scope === command.role.scope
                                )
                        )
                    )
                        throw new Error('权限不适用于此作用域');
                    const now = new Date().toISOString();
                    data.roles.push({
                        ...body,
                        id: nextId(),
                        organizationId: selection.organizationId,
                        protected: false,
                        canEdit: true,
                        grantable: true,
                        createdAt: now,
                        updatedAt: now,
                        archivedAt: null,
                    });
                } else if (command.kind === 'update-role' || command.kind === 'archive-role') {
                    const current = role(selection.organizationId, command.id);
                    if (current.protected) throw new Error('系统角色不能修改');
                    if (command.kind === 'update-role') {
                        const parsed = TeamRoleUpdateSchema.safeParse(command.role);
                        if (!parsed.success) throw new Error('角色名称或权限格式无效');
                        if (
                            command.role.permissions.some(
                                (code) =>
                                    !data.definitions.some(
                                        (item) => item.code === code && item.scope === current.scope
                                    )
                            )
                        )
                            throw new Error('权限不适用于此作用域');
                        current.name = parsed.data.name;
                        current.permissions = [...parsed.data.permissions];
                        current.updatedAt = new Date().toISOString();
                        record(
                            selection.organizationId,
                            null,
                            '更新角色定义',
                            current.id,
                            current.name
                        );
                    } else {
                        if (
                            data.members.some((item) =>
                                item.roles.some((role) => role.id === current.id)
                            ) ||
                            data.workspaceMembers.some((item) => item.roleIds.includes(current.id))
                        )
                            throw new Error('角色仍有成员绑定，不能归档');
                        current.archivedAt = new Date().toISOString();
                    }
                } else if (command.kind === 'bind' || command.kind === 'remove-member') {
                    const binding = selection.workspaceId
                        ? requireValue(
                              data.workspaceMembers.find(
                                  (item) =>
                                      item.organizationId === selection.organizationId &&
                                      item.workspaceId === selection.workspaceId &&
                                      item.id === command.id
                              )
                          )
                        : undefined;
                    const current = member(
                        selection.organizationId,
                        binding?.organizationMemberId ?? command.id
                    );
                    if (current.isOwner) throw new Error('不能变更所有者的成员身份');
                    if (command.kind === 'bind') {
                        const scope = selection.workspaceId ? 'WORKSPACE' : 'ORGANIZATION';
                        const chosen = command.roleIds.map((id) =>
                            role(selection.organizationId, id)
                        );
                        if (
                            chosen.some(
                                (item) =>
                                    item.scope !== scope || (item.protected && !item.grantable)
                            )
                        )
                            throw new Error('角色不能分配到此范围');
                        if (binding) binding.roleIds = [...command.roleIds];
                        else
                            current.roles = chosen.map((item) => ({
                                id: item.id,
                                name: item.name,
                            }));
                    } else {
                        const now = new Date().toISOString();
                        if (binding) {
                            binding.status = 'LEFT';
                            binding.leftAt = now;
                        } else {
                            current.status = 'LEFT';
                            current.leftAt = now;
                            data.workspaceMembers
                                .filter((item) => item.organizationMemberId === current.id)
                                .forEach((item) => {
                                    item.status = 'LEFT';
                                    item.leftAt = now;
                                });
                        }
                    }
                } else if (command.kind === 'add-member') {
                    const current = requireValue(
                        data.members.find(
                            (item) =>
                                item.organizationId === selection.organizationId &&
                                item.email === command.email &&
                                item.status === 'ACTIVE'
                        )
                    );
                    const workspaceId = requireValue(selection.workspaceId);
                    if (workspace(workspaceId).organizationId !== selection.organizationId)
                        throw new Error('工作区不属于当前组织');
                    const existing = data.workspaceMembers.find(
                        (item) =>
                            item.workspaceId === workspaceId &&
                            item.organizationMemberId === current.id
                    );
                    if (existing?.status === 'ACTIVE') throw new Error('该成员已在工作区中');
                    if (existing) {
                        existing.status = 'ACTIVE';
                        existing.leftAt = null;
                    } else
                        data.workspaceMembers.push({
                            id: nextId(),
                            organizationId: selection.organizationId,
                            workspaceId,
                            organizationMemberId: current.id,
                            status: 'ACTIVE',
                            joinedAt: new Date().toISOString(),
                            leftAt: null,
                            roleIds: [],
                        });
                } else if (command.kind === 'invite') {
                    invitations.push({
                        id: nextId(),
                        organizationId: selection.organizationId,
                        workspaceId: selection.workspaceId ?? null,
                        workspaceName: selection.workspaceId
                            ? workspace(selection.workspaceId).name
                            : null,
                        email: command.email,
                        expiresAt: '2027-01-01T00:00:00.000Z',
                        status: 'pending',
                    });
                    return { delivery: 'unavailable' };
                } else if (command.kind === 'resend' || command.kind === 'revoke') {
                    const invitation = requireValue(
                        invitations.find(
                            (item) =>
                                item.id === command.id &&
                                item.organizationId === selection.organizationId
                        )
                    );
                    if (!['pending', 'expired'].includes(invitation.status))
                        throw new Error('邀请状态已变化');
                    invitation.status = command.kind === 'revoke' ? 'revoked' : 'pending';
                    if (command.kind === 'resend') return { delivery: 'unavailable' };
                } else throw new Error('模拟详情不支持此操作');
                return {};
            },
            async inspect() {
                throw new Error('模拟详情不提供邀请链接');
            },
            async accept() {
                throw new Error('模拟详情不提供邀请链接');
            },
        },
    };
    return source;
}
