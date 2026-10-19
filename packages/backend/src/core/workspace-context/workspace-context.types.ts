import type {
    OrganizationContext,
    OrganizationAccessContext,
} from '../organization-context/organization-context.types.js';

export interface WorkspaceContext extends OrganizationContext {
    readonly workspaceId: string;
    readonly workspaceMemberId: string;
}

export interface WorkspaceAccessContext extends OrganizationAccessContext {
    readonly workspaceId: string;
    readonly workspaceMemberId: string | null;
}
