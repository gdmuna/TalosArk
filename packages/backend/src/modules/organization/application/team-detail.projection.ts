import type { Prisma } from '@root/prisma/generated/client.js';

export const managementWorkspaceSelect = {
    id: true,
    organizationId: true,
    name: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    archivedAt: true,
} satisfies Prisma.WorkspaceSelect;
export const managementRoleSelect = {
    id: true,
    organizationId: true,
    code: true,
    name: true,
    scope: true,
    createdAt: true,
    updatedAt: true,
    archivedAt: true,
    permissions: { select: { permissionCode: true } },
} satisfies Prisma.RoleSelect;
export const managementMemberSelect = {
    id: true,
    organizationId: true,
    userId: true,
    status: true,
    joinedAt: true,
    leftAt: true,
    user: { select: { username: true, email: true } },
    roleBindings: {
        where: { role: { archivedAt: null } },
        select: { role: { select: { id: true, name: true } } },
    },
} satisfies Prisma.OrganizationMemberSelect;

type WorkspaceRow = Prisma.WorkspaceGetPayload<{ select: typeof managementWorkspaceSelect }>;
type RoleRow = Prisma.RoleGetPayload<{ select: typeof managementRoleSelect }>;
type MemberRow = Prisma.OrganizationMemberGetPayload<{ select: typeof managementMemberSelect }>;

export function workspaceDetailView(row: WorkspaceRow) {
    return {
        id: row.id,
        organizationId: row.organizationId,
        name: row.name,
        description: row.description ?? '',
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        archivedAt: row.archivedAt?.toISOString() ?? null,
    };
}
export function roleDetailView(row: RoleRow, protectedCodes: ReadonlySet<string>) {
    return {
        id: row.id,
        organizationId: row.organizationId,
        code: row.code,
        name: row.name,
        scope: row.scope,
        permissions: row.permissions.map((item) => item.permissionCode),
        protected: protectedCodes.has(row.code),
        grantable: false,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        archivedAt: row.archivedAt?.toISOString() ?? null,
    };
}
export function memberDetailView(row: MemberRow, ownerUserId: string, includeRoles = true) {
    return {
        id: row.id,
        organizationMemberId: row.id,
        organizationId: row.organizationId,
        userId: row.userId,
        name: row.user.username,
        email: row.user.email,
        status: row.status,
        isOwner: row.userId === ownerUserId,
        roles: includeRoles ? row.roleBindings.map((item) => item.role) : [],
        joinedAt: row.joinedAt.toISOString(),
        leftAt: row.leftAt?.toISOString() ?? null,
    };
}
