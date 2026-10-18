export type TeamManagementListState = {
    organizationId: string;
    workspaceId?: string;
    tab: 'members' | 'invitations';
    search: string;
    page: number;
    pageSize: number;
    roleFilter: 'all' | 'ORGANIZATION' | 'WORKSPACE';
    roleView: 'list' | 'matrix';
};
