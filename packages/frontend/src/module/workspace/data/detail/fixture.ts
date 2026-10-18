import type { DetailCatalog, DetailWorkspace, DetailRole } from '../../model/management-detail';

export const detailId = (value: number) =>
    `019a0000-0000-7000-8000-${String(value).padStart(12, '0')}`;
const date = '2026-09-15T02:00:00.000Z';
export function createDetailFixture(): DetailCatalog {
    const organizationId = detailId(1),
        otherOrganizationId = detailId(2);
    const workspaces: [DetailWorkspace, DetailWorkspace, DetailWorkspace] = [
        {
            id: detailId(11),
            organizationId,
            name: '王教授课题组',
            description: '细胞培养、材料管理与日常实验协作。',
            createdAt: date,
            updatedAt: date,
            archivedAt: null,
        },
        {
            id: detailId(12),
            organizationId,
            name: '公共平台',
            description: '共享设施与设备管理。',
            createdAt: date,
            updatedAt: date,
            archivedAt: null,
        },
        {
            id: detailId(13),
            organizationId: otherOrganizationId,
            name: '样本中心',
            description: '研究样本归档。',
            createdAt: date,
            updatedAt: date,
            archivedAt: null,
        },
    ];
    const definitions = [
        { code: 'organization.read', name: '查看组织', scope: 'ORGANIZATION' as const },
        {
            code: 'organization.member.manage',
            name: '管理组织成员',
            scope: 'ORGANIZATION' as const,
        },
        { code: 'organization.role.manage', name: '管理角色定义', scope: 'ORGANIZATION' as const },
        {
            code: 'organization.invitation.manage',
            name: '管理组织邀请',
            scope: 'ORGANIZATION' as const,
        },
        { code: 'workspace.create', name: '创建工作区', scope: 'ORGANIZATION' as const },
        { code: 'workspace.read', name: '查看工作区', scope: 'WORKSPACE' as const },
        { code: 'workspace.member.manage', name: '管理工作区成员', scope: 'WORKSPACE' as const },
    ];
    const roles: [DetailRole, DetailRole, DetailRole, DetailRole, DetailRole] = [
        {
            id: detailId(31),
            organizationId,
            code: 'organization-owner',
            name: '组织所有者',
            scope: 'ORGANIZATION' as const,
            permissions: definitions
                .filter((item) => item.scope === 'ORGANIZATION')
                .map((item) => item.code),
            protected: true,
            grantable: false,
            createdAt: date,
            updatedAt: date,
            archivedAt: null,
        },
        {
            id: detailId(32),
            organizationId,
            code: 'workspace-manager',
            name: '工作区管理员',
            scope: 'WORKSPACE' as const,
            permissions: ['workspace.read', 'workspace.member.manage'],
            protected: true,
            grantable: true,
            createdAt: date,
            updatedAt: date,
            archivedAt: null,
        },
        {
            id: detailId(33),
            organizationId,
            code: 'research-reader',
            name: '研究成员',
            scope: 'WORKSPACE' as const,
            permissions: ['workspace.read'],
            protected: false,
            grantable: true,
            createdAt: date,
            updatedAt: date,
            archivedAt: null,
        },
        {
            id: detailId(34),
            organizationId: otherOrganizationId,
            code: 'sample-reader',
            name: '归档成员',
            scope: 'WORKSPACE' as const,
            permissions: ['workspace.read'],
            protected: false,
            grantable: true,
            createdAt: date,
            updatedAt: date,
            archivedAt: null,
        },
        {
            id: detailId(35),
            organizationId,
            code: 'organization-observer',
            name: '组织观察者',
            scope: 'ORGANIZATION' as const,
            permissions: ['organization.read'],
            protected: false,
            grantable: true,
            createdAt: date,
            updatedAt: date,
            archivedAt: null,
        },
    ];
    const names = ['王教授', '张晓明', '李雨桐', '陈思远', '刘佳宁', '赵嘉宁'] as const;
    const members = names.map((name, index) => ({
        id: detailId(101 + index),
        organizationMemberId: detailId(101 + index),
        userId: detailId(201 + index),
        organizationId,
        name,
        email: `researcher${index + 1}@example.test`,
        status: index === 5 ? ('LEFT' as const) : ('ACTIVE' as const),
        isOwner: index === 0,
        roles:
            index === 0
                ? [{ id: roles[0].id, name: roles[0].name }]
                : index === 1
                  ? [{ id: roles[4].id, name: roles[4].name }]
                  : [],
        joinedAt: date,
        leftAt: index === 5 ? '2026-10-01T08:00:00.000Z' : null,
    }));
    members.push({
        id: detailId(111),
        organizationMemberId: detailId(111),
        userId: detailId(202),
        organizationId: otherOrganizationId,
        name: '张晓明',
        email: 'researcher2@example.test',
        status: 'ACTIVE',
        isOwner: false,
        roles: [],
        joinedAt: date,
        leftAt: null,
    });
    const workspaceMembers = members.slice(0, 4).map((member, index) => ({
        id: detailId(301 + index),
        organizationId,
        workspaceId: workspaces[0].id,
        organizationMemberId: member.id,
        status: 'ACTIVE' as const,
        joinedAt: date,
        leftAt: null,
        roleIds: [roles[index < 2 ? 1 : 2].id],
    }));
    workspaceMembers.push({
        id: detailId(311),
        organizationId,
        workspaceId: workspaces[1].id,
        organizationMemberId: detailId(102),
        status: 'ACTIVE',
        joinedAt: date,
        leftAt: null,
        roleIds: [roles[2].id],
    });
    workspaceMembers.push({
        id: detailId(312),
        organizationId: otherOrganizationId,
        workspaceId: workspaces[2].id,
        organizationMemberId: detailId(111),
        status: 'ACTIVE',
        joinedAt: date,
        leftAt: null,
        roleIds: [roles[3].id],
    });
    const resourceSeeds = [
        ['HeLa 细胞系', 'material', 'owned', '2026-10-16'],
        ['DMEM 高糖培养基', 'material', 'owned', '2026-09-30'],
        ['200 μL 移液器吸头', 'material', 'owned', '2026-10-04'],
        ['HeLa 冻存样本', 'stock', 'owned', '2026-10-09'],
        ['超低温冰箱 -02', 'equipment', 'owned', '2026-10-15'],
        ['细胞培养室', 'facility', 'managed', '2026-09-24'],
    ] as const;
    const resources = resourceSeeds.map(([name, kind, relation, created], index) => ({
        id: detailId(401 + index),
        resourceId: detailId(501 + index),
        organizationId,
        workspaceId: workspaces[0].id,
        name,
        kind,
        relation,
        createdAt: created + 'T02:00:00.000Z',
    }));
    const facilityAccess = [
        {
            facilityId: detailId(406),
            organizationId,
            name: '细胞培养室',
            managementWorkspaceId: workspaces[0].id,
            workspaceId: workspaces[1].id,
            level: 'READ' as const,
            createdAt: date,
        },
        {
            facilityId: detailId(407),
            organizationId,
            name: '低温保存中心',
            managementWorkspaceId: workspaces[1].id,
            workspaceId: workspaces[0].id,
            level: 'OPERATE' as const,
            createdAt: date,
        },
    ];
    const activities = [
        {
            id: detailId(601),
            organizationId,
            workspaceId: workspaces[0].id,
            actorUserId: detailId(202),
            actorName: names[1],
            action: '登记材料',
            subjectId: detailId(401),
            subjectName: resourceSeeds[0][0],
            occurredAt: '2026-10-16T03:20:00.000Z',
        },
        {
            id: detailId(602),
            organizationId,
            workspaceId: workspaces[0].id,
            actorUserId: detailId(201),
            actorName: names[0],
            action: '调整成员角色',
            subjectId: detailId(102),
            subjectName: names[1],
            occurredAt: '2026-10-15T07:10:00.000Z',
        },
        {
            id: detailId(603),
            organizationId,
            workspaceId: null,
            actorUserId: detailId(201),
            actorName: names[0],
            action: '创建角色',
            subjectId: roles[2].id,
            subjectName: roles[2].name,
            occurredAt: date,
        },
    ];
    return {
        organizations: [
            { id: organizationId, name: '上海交通大学' },
            { id: otherOrganizationId, name: '苏州研究所' },
        ],
        workspaces,
        members,
        workspaceMembers,
        roles,
        definitions,
        resources,
        facilityAccess,
        activities,
    };
}
