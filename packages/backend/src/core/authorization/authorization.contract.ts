import type { OrganizationContext } from '@/core/organization-context/index.js';
import type { WorkspaceContext } from '@/core/workspace-context/index.js';
import type {
    PermissionScope,
    PermissionScopeQuery,
    PermissionSubject,
} from '@/core/permission/index.js';

export interface AuthorizationRequest {
    readonly subject: PermissionSubject;
    readonly permissionCode: string;
    readonly target: PermissionScope;
}

/** A current-operation observation, never a reusable credential or a bypass for later checks. */
export interface AuthorizedContext {
    readonly subject: PermissionSubject;
    readonly permissionCode: string;
    readonly scope: PermissionScope;
    readonly organization: OrganizationContext;
    readonly workspace?: WorkspaceContext;
}

export type AuthorizationDecision =
    | { readonly allowed: true; readonly context: AuthorizedContext }
    | { readonly allowed: false; readonly reason: 'context-unavailable' | 'no-grant' };

export type AuthorizationScopeQuery = PermissionScopeQuery;
export type AccessScope =
    | { readonly kind: 'none' }
    | { readonly kind: 'organization'; readonly organizationIds: readonly string[] }
    | {
          readonly kind: 'workspace';
          readonly workspaces: readonly {
              readonly organizationId: string;
              readonly workspaceId: string;
          }[];
      };
