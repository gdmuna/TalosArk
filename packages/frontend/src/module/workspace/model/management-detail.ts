import type { TeamMember, TeamRole, TeamManagement } from '@talos-ark/contracts/team';

export type DetailOrganization = { id: string; name: string };
export type DetailWorkspace = {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
};
export type DetailMember = TeamMember & {
    organizationId: string;
    joinedAt: string;
    leftAt: string | null;
};
export type DetailWorkspaceMember = {
    id: string;
    organizationId: string;
    workspaceId: string;
    organizationMemberId: string;
    status: TeamMember['status'];
    joinedAt: string;
    leftAt: string | null;
    roleIds: string[];
};
export type DetailRole = TeamRole & {
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
};
export type DetailResource = {
    id: string;
    resourceId: string;
    organizationId: string;
    workspaceId: string;
    name: string;
    kind: 'material' | 'stock' | 'equipment' | 'facility';
    relation: 'owned' | 'managed' | 'accessible';
    createdAt: string;
};
export type DetailFacilityAccess = {
    facilityId: string;
    organizationId: string;
    name: string;
    managementWorkspaceId: string;
    workspaceId: string;
    level: 'READ' | 'OPERATE';
    createdAt: string;
};
export type DetailActivity = {
    id: string;
    organizationId: string;
    workspaceId: string | null;
    actorUserId: string;
    actorName: string;
    action: string;
    subjectId: string;
    subjectName: string;
    occurredAt: string;
};
export type DetailCatalog = {
    organizations: DetailOrganization[];
    workspaces: DetailWorkspace[];
    members: DetailMember[];
    workspaceMembers: DetailWorkspaceMember[];
    roles: DetailRole[];
    definitions: TeamManagement['definitions'];
    resources: DetailResource[];
    facilityAccess: DetailFacilityAccess[];
    activities: DetailActivity[];
};
export type WorkspaceDetail = {
    canUpdate: boolean;
    workspace: DetailWorkspace;
    organization: DetailOrganization;
    members: DetailMember[];
    memberships: DetailWorkspaceMember[];
    roles: DetailRole[];
    roleBindings: Record<string, number>;
    resourceCreations: { from: string; to: string; points: { label: string; count: number }[] };
    resources: DetailResource[];
    outgoingAccess: DetailFacilityAccess[];
    incomingAccess: DetailFacilityAccess[];
    activities: DetailActivity[];
};
export type MemberDetail = {
    canManageRoles: boolean;
    member: DetailMember;
    organization: DetailOrganization;
    workspaces: (DetailWorkspaceMember & { workspace: DetailWorkspace; roles: DetailRole[] })[];
    roles: DetailRole[];
    activities: DetailActivity[];
};
export type RoleDetail = {
    canEdit: boolean;
    role: DetailRole;
    organization: DetailOrganization;
    definitions: TeamManagement['definitions'];
    bindings: { member: DetailMember; workspace: DetailWorkspace | null; joinedAt: string }[];
    activities: DetailActivity[];
};
