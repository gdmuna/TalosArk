import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import {
    OrganizationContextKernel,
    OrganizationContextError,
} from '@/core/organization-context/index.js';
import type { WorkspaceContext } from './workspace-context.types.js';

@Injectable()
export class WorkspaceContextKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly organizationContext: OrganizationContextKernel
    ) {}

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
