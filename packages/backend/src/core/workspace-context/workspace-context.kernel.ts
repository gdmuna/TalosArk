import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import {
    OrganizationContextKernel,
    OrganizationContextError,
} from '@/core/organization-context/index.js';
import type { WorkspaceContext, WorkspaceAccessContext } from './workspace-context.types.js';

@Injectable()
export class WorkspaceContextKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly organizationContext: OrganizationContextKernel
    ) {}

    async requireAccess(
        userId: string,
        organizationId: string,
        workspaceId: string
    ): Promise<WorkspaceAccessContext> {
        const organization = await this.organizationContext.requireAccess(userId, organizationId);
        const workspace = await this.database.queryClient.workspace.findFirst({
            where: { id: workspaceId, organizationId, archivedAt: null },
            select: {
                members: {
                    where: { status: 'ACTIVE', organizationMember: { userId, status: 'ACTIVE' } },
                    select: { id: true },
                    take: 1,
                },
            },
        });
        if (!workspace) throw new OrganizationContextError({ reason: 'forbidden' });
        const member = workspace.members[0];
        if (!member && !organization.isSuperAdmin)
            throw new OrganizationContextError({ reason: 'forbidden' });
        return Object.freeze({
            ...organization,
            workspaceId,
            workspaceMemberId: member?.id ?? null,
        });
    }

    async requireMembership(
        userId: string,
        organizationId: string,
        workspaceId: string
    ): Promise<WorkspaceContext> {
        const organizationContext = await this.organizationContext.requireMembership(
            userId,
            organizationId
        );
        const member = await this.database.queryClient.workspaceMember.findFirst({
            where: {
                organizationId,
                workspaceId,
                organizationMemberId: organizationContext.organizationMemberId,
                status: 'ACTIVE',
                workspace: { archivedAt: null },
            },
            select: { id: true },
        });
        if (!member) throw new OrganizationContextError({ reason: 'forbidden' });
        return Object.freeze({ ...organizationContext, workspaceId, workspaceMemberId: member.id });
    }
}
