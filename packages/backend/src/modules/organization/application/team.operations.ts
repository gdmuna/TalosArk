import { Injectable } from '@nestjs/common';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { OrganizationContextKernel } from '@/core/organization-context/index.js';
import { AuditKernel, type AuditValue } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';

export const protectedRoleCodes = new Set([
    'organization-owner',
    'organization-governance',
    'organization-member',
    'workspace-manager',
    'workspace-member',
]);

@Injectable()
export class TeamOperations {
    constructor(
        private readonly writes: OrganizationWriteKernel,
        private readonly organization: OrganizationContextKernel,
        private readonly audit: AuditKernel,
        private readonly context: AlsContextAdapter
    ) {}

    actor() {
        return this.context.requireActor().userId;
    }

    write<TAuthorization, TResult>(
        organizationId: string,
        authorize: () => Promise<TAuthorization>,
        execute: (authorization: TAuthorization) => Promise<TResult>
    ): Promise<TResult> {
        return this.writes.run({
            organizationId,
            authorize: async () => {
                await this.organization.requireAccess(this.actor(), organizationId);
                return authorize();
            },
            execute,
        });
    }

    acceptInvitation<TAuthorization, TResult>(
        organizationId: string,
        authorize: () => Promise<TAuthorization>,
        execute: (authorization: TAuthorization) => Promise<TResult>
    ): Promise<TResult> {
        return this.writes.run({ organizationId, authorize, execute });
    }

    record(
        organizationId: string,
        action: string,
        details: Record<string, AuditValue>,
        workspaceId?: string
    ) {
        return this.audit.record({
            organizationId,
            workspaceId,
            actorUserId: this.actor(),
            action,
            occurredAt: new Date(),
            requestId: this.context.get()?.requestId,
            details,
        });
    }
}
