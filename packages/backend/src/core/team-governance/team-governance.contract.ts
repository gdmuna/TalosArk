import type { OrganizationAccessContext } from '@/core/organization-context/index.js';
import type { PermissionSubject } from '@/core/permission/index.js';

export interface OrganizationGovernanceInput {
    readonly subject: PermissionSubject;
    readonly organizationId: string;
}

export interface TeamGovernanceInput extends OrganizationGovernanceInput {
    readonly workspaceId?: string;
}

export interface WorkspaceGovernanceInput extends OrganizationGovernanceInput {
    readonly workspaceId: string;
}

export type TeamMemberVisibility =
    | { readonly kind: 'organization'; readonly organizationId: string }
    | {
          readonly kind: 'workspace';
          readonly organizationId: string;
          readonly workspaceId: string;
      }
    | { readonly kind: 'self'; readonly userId: string };

/** An observation for the current operation, never a reusable authorization credential. */
export interface TeamGovernanceSnapshot {
    readonly organization: OrganizationAccessContext;
    readonly canManageOrganizationMembers: boolean;
    readonly canEditRoleDefinitions: boolean;
    readonly canInvite: boolean;
    readonly memberVisibility: TeamMemberVisibility;
}

export interface WorkspaceGovernanceSnapshot {
    readonly userId: string;
    readonly isSuperAdmin: boolean;
    readonly canManageOrganizationMembers: boolean;
    readonly canViewMembers: boolean;
    readonly canUpdate: boolean;
    readonly canReadActivity: boolean;
}
