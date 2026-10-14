import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuthorizationRegistry } from './authorization.registry.js';

/** Registered scopes constrain live allow-only grants, never grant access themselves. */
@Injectable()
export class PermissionKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly authorization: AuthorizationRegistry
    ) {}

    async organizationIds(userId: string, permissionCode: string): Promise<string[]> {
        if (this.authorization.find(permissionCode)?.scope !== 'ORGANIZATION') return [];
        const bindings = await this.database.queryClient.organizationRoleBinding.findMany({
            where: {
                member: { userId, status: 'ACTIVE', organization: { archivedAt: null } },
                role: {
                    scope: 'ORGANIZATION',
                    archivedAt: null,
                    permissions: { some: { permissionCode } },
                },
            },
            select: { organizationId: true },
        });
        return [...new Set(bindings.map((binding) => binding.organizationId))];
    }

    async workspaceIds(userId: string, permissionCode: string): Promise<string[]> {
        if (this.authorization.find(permissionCode)?.scope !== 'WORKSPACE') return [];
        const bindings = await this.database.queryClient.workspaceRoleBinding.findMany({
            where: {
                member: {
                    status: 'ACTIVE',
                    workspace: { archivedAt: null, organization: { archivedAt: null } },
                    organizationMember: { userId, status: 'ACTIVE' },
                },
                role: {
                    scope: 'WORKSPACE',
                    archivedAt: null,
                    permissions: { some: { permissionCode } },
                },
            },
            select: { workspaceId: true },
        });
        return [...new Set(bindings.map((binding) => binding.workspaceId))];
    }
}
