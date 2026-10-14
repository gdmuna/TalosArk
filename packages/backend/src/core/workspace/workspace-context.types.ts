import type { TenantMembership } from '../tenant/tenant.types.js';

export interface WorkspaceContext extends TenantMembership {
    readonly workspaceId: string;
    readonly workspaceMemberId: string;
}
