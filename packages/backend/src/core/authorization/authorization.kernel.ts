import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationContextError } from '@/core/organization-context/index.js';
import {
    PermissionKernel,
    PermissionError,
    parsePermissionCheck,
} from '@/core/permission/index.js';
import type {
    AuthorizationDecision,
    AuthorizationRequest,
    AuthorizationScopeQuery,
    AuthorizedContext,
    AccessScope,
} from './authorization.contract.js';
import { AuthorizationError } from './authorization.error.js';
import { AuthorizationContextResolver } from './internal/authorization.context-resolver.js';
import { accessScope } from './internal/authorization.scope-planner.js';

@Injectable()
export class AuthorizationKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly permission: PermissionKernel,
        private readonly contexts: AuthorizationContextResolver
    ) {}

    check(input: AuthorizationRequest): Promise<AuthorizationDecision> {
        const check = parsePermissionCheck({
            subject: input.subject,
            permissionCode: input.permissionCode,
            scope: input.target,
        });
        const definition = this.permission.definition(check.permissionCode);
        if (
            definition.scope !==
            (check.scope.kind === 'organization' ? 'ORGANIZATION' : 'WORKSPACE')
        )
            throw new PermissionError({ reason: 'scope-conflict', code: check.permissionCode });
        return this.database.transaction.run(
            async () => {
                let context: AuthorizedContext;
                try {
                    context = await this.contexts.resolve(check);
                } catch (error) {
                    if (OrganizationContextError.is(error) && error.failure.reason === 'forbidden')
                        return Object.freeze({ allowed: false, reason: 'context-unavailable' });
                    throw error;
                }
                const decision = await this.permission.evaluate(check);
                return decision.allowed
                    ? Object.freeze({ allowed: true, context })
                    : Object.freeze({ allowed: false, reason: 'no-grant' });
            },
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }

    async require(input: AuthorizationRequest): Promise<AuthorizedContext> {
        const decision = await this.check(input);
        if (!decision.allowed) throw new AuthorizationError({ reason: 'forbidden' });
        return decision.context;
    }

    async scope(input: AuthorizationScopeQuery): Promise<AccessScope> {
        return accessScope(await this.permission.scopes(input));
    }
}
