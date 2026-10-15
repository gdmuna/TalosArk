import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuthorizationRegistry } from '../authorization.registry.js';
import type { AuthorizationScope } from '../authorization-definition.js';
import type {
    CreatePermissionRole,
    PermissionRole,
    PermissionRoleBinding,
} from '../permission.contract.js';
import { PermissionError } from '../permission.error.js';
import {
    parsePermissionInput,
    permissionCodeSchema,
    permissionScopeSchema,
    permissionIdSchema,
} from './permission.input.js';

const roleLookupSchema = z.strictObject({
    organizationId: permissionIdSchema,
    scope: z.enum(['ORGANIZATION', 'WORKSPACE']),
    code: z
        .string()
        .min(1)
        .max(120)
        .regex(/^[a-z][a-z0-9-]*$/),
});
const createRoleSchema = roleLookupSchema.extend({
    name: z.string().trim().min(1).max(160),
    permissions: z.array(permissionCodeSchema).max(256),
});
const bindingSchema = z.strictObject({
    scope: permissionScopeSchema,
    memberId: permissionIdSchema,
    roleId: permissionIdSchema,
});
const replaceSchema = z.strictObject({
    organizationId: permissionIdSchema,
    roleId: permissionIdSchema,
    permissions: z.array(permissionCodeSchema).max(256),
});
const roleSelect = {
    id: true,
    organizationId: true,
    scope: true,
    code: true,
    name: true,
    archivedAt: true,
    permissions: { select: { permissionCode: true } },
} as const;

function roleView(
    role: Omit<PermissionRole, 'permissions'> & { permissions: { permissionCode: string }[] }
): PermissionRole {
    return Object.freeze({
        ...role,
        permissions: Object.freeze(role.permissions.map((item) => item.permissionCode)),
    });
}

@Injectable()
export class PermissionRoleWriter {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly registry: AuthorizationRegistry
    ) {}

    async find(input: {
        organizationId: string;
        scope: AuthorizationScope;
        code: string;
    }): Promise<PermissionRole | null> {
        const key = parsePermissionInput(roleLookupSchema, input);
        const role = await this.database.queryClient.role.findUnique({
            where: { organizationId_scope_code: key },
            select: roleSelect,
        });
        return role && roleView(role);
    }

    create(input: CreatePermissionRole): Promise<PermissionRole> {
        return this.write(async () => {
            const data = parsePermissionInput(createRoleSchema, input);
            const permissions = [...new Set(data.permissions)];
            await this.catalog(permissions, data.scope);
            const role = await this.database.queryClient.role.create({
                data: {
                    organizationId: data.organizationId,
                    scope: data.scope,
                    code: data.code,
                    name: data.name,
                    permissions: {
                        create: permissions.map((permissionCode) => ({ permissionCode })),
                    },
                },
                select: roleSelect,
            });
            return roleView(role);
        });
    }

    replacePermissions(input: {
        organizationId: string;
        roleId: string;
        permissions: readonly string[];
    }): Promise<void> {
        return this.write(async () => {
            const data = parsePermissionInput(replaceSchema, input);
            // Updating the parent serializes replacements, including older RepeatableRead snapshots.
            const locked = await this.database.queryClient.role.updateMany({
                where: { id: data.roleId, organizationId: data.organizationId, archivedAt: null },
                data: { updatedAt: new Date() },
            });
            if (!locked.count) throw new PermissionError({ reason: 'role-unavailable' });
            const role = await this.database.queryClient.role.findFirst({
                where: { id: data.roleId, organizationId: data.organizationId, archivedAt: null },
                select: { scope: true },
            });
            if (!role) throw new PermissionError({ reason: 'role-unavailable' });
            const codes = [...new Set(data.permissions)];
            await this.catalog(codes, role.scope);
            await this.database.queryClient.rolePermission.deleteMany({
                where: { roleId: data.roleId },
            });
            if (codes.length)
                await this.database.queryClient.rolePermission.createMany({
                    data: codes.map((permissionCode) => ({ roleId: data.roleId, permissionCode })),
                });
        });
    }

    bind(input: PermissionRoleBinding): Promise<void> {
        return this.write(async () => {
            const { scope, roleId, memberId } = parsePermissionInput(bindingSchema, input);
            const role = await this.database.queryClient.role.findFirst({
                where: {
                    id: roleId,
                    organizationId: scope.organizationId,
                    scope: scope.kind === 'organization' ? 'ORGANIZATION' : 'WORKSPACE',
                    archivedAt: null,
                },
                select: { id: true },
            });
            if (!role) throw new PermissionError({ reason: 'role-unavailable' });
            if (scope.kind === 'organization') {
                const member = await this.database.queryClient.organizationMember.findFirst({
                    where: {
                        id: memberId,
                        organizationId: scope.organizationId,
                        status: 'ACTIVE',
                        organization: { archivedAt: null },
                    },
                    select: { id: true },
                });
                if (!member) throw new PermissionError({ reason: 'member-unavailable' });
                await this.database.queryClient.organizationRoleBinding.createMany({
                    data: {
                        organizationId: scope.organizationId,
                        organizationMemberId: memberId,
                        roleId,
                    },
                    skipDuplicates: true,
                });
            } else {
                const member = await this.database.queryClient.workspaceMember.findFirst({
                    where: {
                        id: memberId,
                        organizationId: scope.organizationId,
                        workspaceId: scope.workspaceId,
                        status: 'ACTIVE',
                        organizationMember: { status: 'ACTIVE' },
                        workspace: { archivedAt: null, organization: { archivedAt: null } },
                    },
                    select: { id: true },
                });
                if (!member) throw new PermissionError({ reason: 'member-unavailable' });
                await this.database.queryClient.workspaceRoleBinding.createMany({
                    data: {
                        organizationId: scope.organizationId,
                        workspaceId: scope.workspaceId,
                        workspaceMemberId: memberId,
                        roleId,
                    },
                    skipDuplicates: true,
                });
            }
        });
    }

    unbind(input: PermissionRoleBinding): Promise<void> {
        return this.write(async () => {
            const { scope, roleId, memberId } = parsePermissionInput(bindingSchema, input);
            if (scope.kind === 'organization')
                await this.database.queryClient.organizationRoleBinding.deleteMany({
                    where: {
                        organizationId: scope.organizationId,
                        organizationMemberId: memberId,
                        roleId,
                    },
                });
            else
                await this.database.queryClient.workspaceRoleBinding.deleteMany({
                    where: {
                        organizationId: scope.organizationId,
                        workspaceId: scope.workspaceId,
                        workspaceMemberId: memberId,
                        roleId,
                    },
                });
        });
    }

    synchronizeCatalog(): Promise<void> {
        return this.write(() =>
            this.catalog(this.registry.definitions().map((definition) => definition.code))
        );
    }

    private async catalog(codes: readonly string[], scope?: AuthorizationScope): Promise<void> {
        const definitions = codes.map((code) => {
            const definition = this.registry.find(code);
            if (!definition) throw new PermissionError({ reason: 'missing-definition', code });
            if (scope && definition.scope !== scope)
                throw new PermissionError({ reason: 'scope-conflict', code });
            return definition;
        });
        for (const definition of definitions.sort((left, right) =>
            left.code.localeCompare(right.code)
        ))
            await this.database.queryClient.permission.upsert({
                where: { code: definition.code },
                update: { name: definition.name },
                create: { code: definition.code, name: definition.name },
            });
    }

    private write<T>(work: () => Promise<T>): Promise<T> {
        return this.database.transaction.run(work, { propagation: 'mandatory' });
    }
}
