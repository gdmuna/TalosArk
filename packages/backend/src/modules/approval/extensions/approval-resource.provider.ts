import { Injectable } from '@nestjs/common';
import {
    ResourceExtension,
    type ResourceProvider,
    type ResourceLookup,
} from '@/core/resource/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { workspacePermission } from '@/core/team-governance/index.js';
import { approvalPermission as p } from '../contribution/approval-authorization.contribution.js';

@Injectable()
@ResourceExtension({ kind: 'APPROVAL_REQUEST' })
export class ApprovalResourceProvider implements ResourceProvider {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly authorization: AuthorizationKernel
    ) {}
    async describe(input: ResourceLookup) {
        const row = await this.database.queryClient.approvalRequest.findFirst({
            where: { resourceId: input.resourceId },
        });
        if (!row) return null;
        const scope = {
            kind: 'workspace' as const,
            organizationId: row.organizationId,
            workspaceId: row.workspaceId,
        };
        const member = await this.authorization.check({
            subject: input.subject,
            target: scope,
            permissionCode: workspacePermission.read,
            expectedScope: input.expectedScope,
        });
        if (!member.allowed) return null;
        if (
            row.requesterId !== input.subject.userId &&
            row.approverId !== input.subject.userId &&
            !(
                await this.authorization.check({
                    subject: input.subject,
                    target: scope,
                    permissionCode: p.readAll,
                })
            ).allowed
        )
            return null;
        return {
            resourceId: row.resourceId,
            kind: 'APPROVAL_REQUEST' as const,
            objectId: row.id,
            scope,
            label: row.type === 'CONSUME' ? '消耗申请' : '转移申请',
            archivedAt: null,
            href: `/main/workbench/request/${row.id}?organization=${row.organizationId}&workspace=${row.workspaceId}`,
        };
    }
}
