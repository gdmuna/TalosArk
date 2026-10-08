export type Organization = { id: string; name: string };
export type Workspace = { id: string; organizationId: string; name: string; description: string };
export type WorkspaceSnapshot = {
    organizations: Organization[];
    workspaces: Workspace[];
    activeId: string;
};
