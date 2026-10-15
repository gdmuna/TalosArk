import type { PermissionScope } from '@/core/permission/index.js';
import type { AccessScope } from '../authorization.contract.js';

export function accessScope(scopes: readonly PermissionScope[]): AccessScope {
    if (!scopes.length) return Object.freeze({ kind: 'none' });
    if (scopes[0].kind === 'organization')
        return Object.freeze({
            kind: 'organization',
            organizationIds: Object.freeze(scopes.map((scope) => scope.organizationId)),
        });
    return Object.freeze({
        kind: 'workspace',
        workspaces: Object.freeze(
            scopes.flatMap((scope) =>
                scope.kind === 'workspace'
                    ? [
                          Object.freeze({
                              organizationId: scope.organizationId,
                              workspaceId: scope.workspaceId,
                          }),
                      ]
                    : []
            )
        ),
    });
}
