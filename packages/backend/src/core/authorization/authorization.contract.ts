import type { OrganizationContext } from '@/core/organization-context/index.js';
import type { WorkspaceContext } from '@/core/workspace-context/index.js';
import type {
    PermissionScope,
    PermissionScopeQuery,
    PermissionSubject,
} from '@/core/permission/index.js';

export interface AuthorizationEntityTarget {
    readonly kind: string;
    readonly id: string;
}

export type AuthorizationTarget = PermissionScope | AuthorizationEntityTarget;

export interface AuthorizationRequest {
    readonly subject: PermissionSubject;
    readonly permissionCode: string;
    readonly target: AuthorizationTarget;
    /** A caller restriction, never a substitute for the target's actual ownership. */
    readonly expectedScope?: PermissionScope;
}

export interface ResolvedContext {
    readonly subject: PermissionSubject;
    readonly permissionCode: string;
    readonly target: AuthorizationTarget;
    readonly scope: PermissionScope;
    readonly organization: OrganizationContext;
    readonly workspace?: WorkspaceContext;
}

/** A current-operation observation, never a reusable credential or a bypass for later checks. */
export interface AuthorizedContext extends ResolvedContext {
    readonly authorized: true;
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
