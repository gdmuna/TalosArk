import { Injectable } from '@nestjs/common';
import {
    OrganizationContextError,
    OrganizationContextKernel,
} from '@/core/organization-context/index.js';
import { WorkspaceContextKernel } from '@/core/workspace-context/index.js';
import {
    PermissionError,
    type AuthorizationScope,
    type PermissionScope,
} from '@/core/permission/index.js';
import type { AuthorizationRequest, ResolvedContext } from '../authorization.contract.js';
import { AuthorizationTargetRegistry } from './authorization-target.registry.js';
import { parseTargetFacts } from './authorization.input.js';

@Injectable()
export class AuthorizationContextResolver {
    constructor(
        private readonly organization: OrganizationContextKernel,
        private readonly workspace: WorkspaceContextKernel,
        private readonly targets: AuthorizationTargetRegistry
    ) {}

    async resolve(
        input: AuthorizationRequest,
        permissionScope: AuthorizationScope
    ): Promise<ResolvedContext | null> {
        const { target, subject, permissionCode, expectedScope } = input;
        let scope: PermissionScope;
        if ('id' in target) {
            const facts = await this.targets
                .require(target.kind)
                .resolve(Object.freeze({ target, permissionCode }));
            if (facts === null) return null;
            scope = parseTargetFacts(facts, target.kind);
        } else {
            scope = target;
        }
        if (permissionScope !== (scope.kind === 'organization' ? 'ORGANIZATION' : 'WORKSPACE'))
            throw new PermissionError({ reason: 'scope-conflict', code: permissionCode });
        if (
            expectedScope &&
            (expectedScope.organizationId !== scope.organizationId ||
                (expectedScope.kind === 'workspace' &&
                    (scope.kind !== 'workspace' ||
                        expectedScope.workspaceId !== scope.workspaceId)))
        )
            return null;

        // Only membership denials become unavailable; provider/dependency failures retain identity.
        try {
            const base = { target, subject, permissionCode, scope };
            if (scope.kind === 'workspace') {
                const context = await this.workspace.requireAccess(
                    subject.userId,
                    scope.organizationId,
                    scope.workspaceId
                );
                const {
                    workspaceId: _workspaceId,
                    workspaceMemberId: _workspaceMemberId,
                    ...organization
                } = context;
                return Object.freeze({
                    ...base,
                    organization: Object.freeze(organization),
                    workspace: context,
                });
            }
            const organization = await this.organization.requireAccess(
                subject.userId,
                scope.organizationId
            );
            return Object.freeze({ ...base, organization });
        } catch (error) {
            if (OrganizationContextError.is(error, 'forbidden')) return null;
            throw error;
        }
    }
}
