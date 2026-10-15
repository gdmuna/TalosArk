import type { AuthorizationScope } from './authorization-definition.js';

export interface PermissionSubject {
    readonly kind: 'user';
    readonly userId: string;
}

export type PermissionScope =
    | { readonly kind: 'organization'; readonly organizationId: string }
    | {
          readonly kind: 'workspace';
          readonly organizationId: string;
          readonly workspaceId: string;
      };

export interface PermissionCheck {
    readonly subject: PermissionSubject;
    readonly permissionCode: string;
    readonly scope: PermissionScope;
}

export interface PermissionScopeQuery {
    readonly subject: PermissionSubject;
    readonly permissionCode: string;
    readonly within?: PermissionScope;
}

export type PermissionDecision =
    | { readonly allowed: true; readonly reason: 'allowed' }
    | { readonly allowed: false; readonly reason: 'no-grant' };

export interface PermissionRole {
    readonly id: string;
    readonly organizationId: string;
    readonly scope: AuthorizationScope;
    readonly code: string;
    readonly name: string;
    readonly archivedAt: Date | null;
    readonly permissions: readonly string[];
}

export interface CreatePermissionRole {
    readonly organizationId: string;
    readonly scope: AuthorizationScope;
    readonly code: string;
    readonly name: string;
    readonly permissions: readonly string[];
}

export interface PermissionRoleBinding {
    readonly scope: PermissionScope;
    readonly memberId: string;
    readonly roleId: string;
}
