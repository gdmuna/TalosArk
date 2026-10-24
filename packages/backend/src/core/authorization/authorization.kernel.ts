import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { PermissionKernel } from '@/core/permission/index.js';
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
import { parseAuthorizationRequest } from './internal/authorization.input.js';

@Injectable()
export class AuthorizationKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly permission: PermissionKernel,
        private readonly contexts: AuthorizationContextResolver
    ) {}

    check(input: AuthorizationRequest): Promise<AuthorizationDecision> {
        const request = parseAuthorizationRequest(input);
        const definition = this.permission.definition(request.permissionCode);
        return this.database.transaction.run(
            async () => {
                const context = await this.contexts.resolve(request, definition.scope);
                if (!context)
                    return Object.freeze({ allowed: false, reason: 'context-unavailable' });
                const decision = await this.permission.evaluate({
                    subject: context.subject,
                    permissionCode: context.permissionCode,
                    scope: context.scope,
                });
                return decision.allowed
                    ? Object.freeze({
                          allowed: true,
                          context: Object.freeze({ ...context, authorized: true }),
                      })
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
