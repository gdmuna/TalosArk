import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import type { AuthorizationScope } from '../authorization-definition.js';
import type { PermissionCheck, PermissionScopeQuery } from '../permission.contract.js';
import type { PermissionGrant } from './permission.engine.js';

@Injectable()
export class PermissionPolicyReader {
    constructor(private readonly database: DatabaseRuntime) {}

    async readMany(checks: readonly PermissionCheck[]): Promise<PermissionGrant[]> {
        const grants: PermissionGrant[] = [];
        for (const userId of new Set(checks.map((check) => check.subject.userId))) {
            const scopes = checks
                .filter((check) => check.subject.userId === userId)
                .map((check) => check.scope);
            const organizations = scopes.filter((scope) => scope.kind === 'organization');
            const workspaces = scopes.filter((scope) => scope.kind === 'workspace');
            if (organizations.length)
                grants.push(
                    ...(await this.organizations(
                        userId,
                        organizations.map((scope) => scope.organizationId)
                    ))
                );
            if (workspaces.length)
                grants.push(
                    ...(await this.workspaces(
                        userId,
                        workspaces.map((scope) => scope.workspaceId)
                    ))
                );
        }
        return grants;
    }

    candidates(query: PermissionScopeQuery, kind: AuthorizationScope): Promise<PermissionGrant[]> {
        return kind === 'ORGANIZATION'
            ? this.organizations(
                  query.subject.userId,
                  query.within && [query.within.organizationId]
              )
            : this.workspaces(
                  query.subject.userId,
                  query.within?.kind === 'workspace' ? [query.within.workspaceId] : undefined,
                  query.within?.organizationId
              );
    }

    private async organizations(
        userId: string,
        organizationIds?: readonly string[]
    ): Promise<PermissionGrant[]> {
        const bindings = await this.database.queryClient.organizationRoleBinding.findMany({
            where: {
                organizationId: organizationIds && { in: [...new Set(organizationIds)] },
                member: { userId, status: 'ACTIVE', organization: { archivedAt: null } },
                role: { scope: 'ORGANIZATION', archivedAt: null },
            },
            select: {
                organizationId: true,
                roleId: true,
                role: { select: { permissions: { select: { permissionCode: true } } } },
            },
        });
        return bindings.map((binding) => ({
            userId,
            roleId: binding.roleId,
            scope: { kind: 'organization', organizationId: binding.organizationId },
            permissions: binding.role.permissions.map((permission) => permission.permissionCode),
        }));
    }

    private async workspaces(
        userId: string,
        workspaceIds?: readonly string[],
        organizationId?: string
    ): Promise<PermissionGrant[]> {
        const bindings = await this.database.queryClient.workspaceRoleBinding.findMany({
            where: {
                organizationId,
                workspaceId: workspaceIds && { in: [...new Set(workspaceIds)] },
                member: {
                    status: 'ACTIVE',
                    organizationMember: { userId, status: 'ACTIVE' },
                    workspace: { archivedAt: null, organization: { archivedAt: null } },
                },
                role: { scope: 'WORKSPACE', archivedAt: null },
            },
            select: {
                organizationId: true,
                workspaceId: true,
                roleId: true,
                role: { select: { permissions: { select: { permissionCode: true } } } },
            },
        });
        return bindings.map((binding) => ({
            userId,
            roleId: binding.roleId,
            scope: {
                kind: 'workspace',
                organizationId: binding.organizationId,
                workspaceId: binding.workspaceId,
            },
            permissions: binding.role.permissions.map((permission) => permission.permissionCode),
        }));
    }
}
