import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuthorizationRegistry } from './authorization.registry.js';
import type { AuthorizationDefinition, AuthorizationScope } from './authorization-definition.js';
import type {
    CreatePermissionRole,
    PermissionCheck,
    PermissionDecision,
    PermissionRoleBinding,
    PermissionScope,
    PermissionScopeQuery,
} from './permission.contract.js';
import { PermissionError } from './permission.error.js';
import { PermissionEngine } from './internal/permission.engine.js';
import { PermissionPolicyReader } from './internal/permission.policy-reader.js';
import { PermissionRoleWriter } from './internal/permission.role-writer.js';
import {
    parsePermissionCheck,
    parsePermissionQuery,
    permissionDomain,
} from './internal/permission.input.js';

@Injectable()
export class PermissionKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly registry: AuthorizationRegistry,
        private readonly engine: PermissionEngine,
        private readonly policies: PermissionPolicyReader,
        private readonly roles: PermissionRoleWriter
    ) {}

    definition(code: string): AuthorizationDefinition {
        const definition = this.registry.find(code);
        if (!definition) throw new PermissionError({ reason: 'missing-definition', code });
        return definition;
    }

    async evaluate(input: PermissionCheck): Promise<PermissionDecision> {
        const [decision] = await this.evaluateMany([input]);
        return decision;
    }

    evaluateMany(input: readonly PermissionCheck[]): Promise<readonly PermissionDecision[]> {
        const checks = input.map((item) => parsePermissionCheck(item));
        for (const check of checks) this.requireScope(check.permissionCode, check.scope);
        return this.read(async () =>
            this.engine.evaluateMany(checks, await this.policies.readMany(checks))
        );
    }

    scopes(input: PermissionScopeQuery): Promise<readonly PermissionScope[]> {
        const query = parsePermissionQuery(input);
        const definition = this.definition(query.permissionCode);
        if (definition.scope === 'ORGANIZATION' && query.within?.kind === 'workspace')
            throw new PermissionError({ reason: 'scope-conflict', code: query.permissionCode });
        return this.read(async () => {
            const grants = await this.policies.candidates(query, definition.scope);
            const scopes = [
                ...new Map(
                    grants.map((grant) => [permissionDomain(grant.scope), grant.scope])
                ).values(),
            ];
            const decisions = await this.engine.evaluateMany(
                scopes.map((scope) => ({
                    subject: query.subject,
                    permissionCode: query.permissionCode,
                    scope,
                })),
                grants
            );
            return Object.freeze(
                scopes
                    .filter((_, index) => decisions[index].allowed)
                    .map((scope) => Object.freeze(scope))
            );
        });
    }

    createRole(input: CreatePermissionRole) {
        return this.roles.create(input);
    }
    findRole(input: { organizationId: string; scope: AuthorizationScope; code: string }) {
        return this.roles.find(input);
    }
    setRolePermissions(input: {
        organizationId: string;
        roleId: string;
        permissions: readonly string[];
    }) {
        return this.roles.replacePermissions(input);
    }
    bindRole(input: PermissionRoleBinding): Promise<void> {
        return this.roles.bind(input);
    }
    unbindRole(input: PermissionRoleBinding): Promise<void> {
        return this.roles.unbind(input);
    }
    synchronizeCatalog(): Promise<void> {
        return this.roles.synchronizeCatalog();
    }

    private requireScope(code: string, scope: PermissionScope): void {
        const expected = scope.kind === 'organization' ? 'ORGANIZATION' : 'WORKSPACE';
        if (this.definition(code).scope !== expected)
            throw new PermissionError({ reason: 'scope-conflict', code });
    }

    private read<T>(work: () => Promise<T>): Promise<T> {
        return this.database.transaction.run(
            work,
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }
}
