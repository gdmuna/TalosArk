import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { TenantKernel, TenantError } from '@/core/tenant/index.js';
import { PermissionKernel } from '@/core/permission/index.js';
import type { WorkspaceContext } from './workspace-context.types.js';

@Injectable()
export class WorkspaceContextKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly tenant: TenantKernel,
        private readonly permission: PermissionKernel
    ) {}

    async requireContext(
        userId: string,
        organizationId: string,
        workspaceId: string,
        permissionCode: string
    ): Promise<WorkspaceContext> {
        const tenant = await this.tenant.requireMembership(userId, organizationId);
        const member = await this.database.queryClient.workspaceMember.findFirst({
            where: {
                organizationId,
                workspaceId,
                organizationMemberId: tenant.organizationMemberId,
                status: 'ACTIVE',
                workspace: { archivedAt: null },
            },
            select: { id: true },
        });
        if (
            !member ||
            !(await this.permission.workspaceIds(userId, permissionCode)).includes(workspaceId)
        )
            throw new TenantError({ reason: 'forbidden' });
        return Object.freeze({ ...tenant, workspaceId, workspaceMemberId: member.id });
    }
}
