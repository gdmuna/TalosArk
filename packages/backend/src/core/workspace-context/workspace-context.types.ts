import type { OrganizationContext } from '../organization-context/organization-context.types.js';

export interface WorkspaceContext extends OrganizationContext {
    readonly workspaceId: string;
    readonly workspaceMemberId: string;
}
