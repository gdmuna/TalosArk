import { Injectable } from '@nestjs/common';
import type { ApprovalScope, ApprovalType } from '@talos-ark/contracts/approval';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { AuthorizationExtension, type PermissionSubject } from '@/core/permission/index.js';
import { WorkspaceContextKernel } from '@/core/workspace-context/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { inventoryPermission } from '@/modules/inventory/public/index.js';
import { materialPermission } from '@/modules/material/public/index.js';
import {
    approvalAuthorization,
    approvalPermission as p,
} from '../contribution/approval-authorization.contribution.js';
import { ApprovalError } from './approval.error.js';

@Injectable()
@AuthorizationExtension(approvalAuthorization)
export class ApprovalAccessService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly authorization: AuthorizationKernel,
        private readonly contexts: WorkspaceContextKernel,
        private readonly actor: AlsContextAdapter
    ) {}
    subject(): PermissionSubject {
        return { kind: 'user', userId: this.actor.requireActor().userId };
    }
    context(scope: ApprovalScope, subject = this.subject()) {
        return this.contexts.requireAccess(subject.userId, scope.organizationId, scope.workspaceId);
    }
    async can(scope: ApprovalScope, permissionCode: string, subject = this.subject()) {
        return (
            await this.authorization.check({
                subject,
                permissionCode,
                target: { kind: 'workspace', ...scope },
            })
        ).allowed;
    }
    async require(scope: ApprovalScope, permissionCode: string, subject = this.subject()) {
        if (!(await this.can(scope, permissionCode, subject)))
            throw new ApprovalError({ reason: 'forbidden' });
    }
    async stockReadable(scope: ApprovalScope, subject = this.subject()) {
        return (
            (await this.can(scope, inventoryPermission.read, subject)) &&
            (await this.can(scope, materialPermission.read, subject))
        );
    }
    async requireStockRead(scope: ApprovalScope, subject = this.subject()) {
        if (!(await this.stockReadable(scope, subject)))
            throw new ApprovalError({ reason: 'forbidden' });
    }
    action(type: ApprovalType, kind: 'apply' | 'review') {
        return type === 'CONSUME'
            ? kind === 'apply'
                ? p.consumeApply
                : p.consumeReview
            : kind === 'apply'
              ? p.transferApply
              : p.transferReview;
    }
    async document(scope: ApprovalScope, id: string) {
        await this.context(scope);
        const row = await this.database.queryClient.approvalRequest.findFirst({
            where: { ...scope, id },
        });
        if (
            !row ||
            (row.requesterId !== this.subject().userId &&
                row.approverId !== this.subject().userId &&
                !(await this.can(scope, p.readAll)))
        )
            throw new ApprovalError({ reason: 'forbidden' });
        return row;
    }
    async capabilities(scope: ApprovalScope) {
        await this.context(scope);
        const capabilities: Record<string, boolean> = {};
        for (const [key, code] of Object.entries(p))
            capabilities[key] = await this.can(scope, code);
        return capabilities;
    }
}
