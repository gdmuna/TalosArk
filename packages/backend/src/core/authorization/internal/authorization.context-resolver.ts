import { Injectable } from '@nestjs/common';
import { OrganizationContextKernel } from '@/core/organization-context/index.js';
import { WorkspaceContextKernel } from '@/core/workspace-context/index.js';
import type { PermissionCheck } from '@/core/permission/index.js';
import type { AuthorizedContext } from '../authorization.contract.js';

@Injectable()
export class AuthorizationContextResolver {
    constructor(
        private readonly organization: OrganizationContextKernel,
        private readonly workspace: WorkspaceContextKernel
    ) {}

    async resolve(check: PermissionCheck): Promise<AuthorizedContext> {
        const { scope, subject } = check;
        if (scope.kind === 'workspace') {
            const context = await this.workspace.requireMembership(
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
                ...check,
                organization: Object.freeze(organization),
                workspace: context,
            });
        }
        const organization = await this.organization.requireMembership(
            subject.userId,
            scope.organizationId
        );
        return Object.freeze({ ...check, organization });
    }
}
