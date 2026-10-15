import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationContextKernel } from '@/core/organization-context/index.js';
import { AuditKernel, type AuditValue } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { TeamError } from './team.error.js';

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
        private readonly database: DatabaseRuntime,
        private readonly organization: OrganizationContextKernel,
        private readonly audit: AuditKernel,
        private readonly context: AlsContextAdapter
    ) {}

    actor() {
        return this.context.requireActor().userId;
    }

    write<T>(
        organizationId: string,
        work: () => Promise<T>,
        acceptingInvitation = false
    ): Promise<T> {
        return this.database.transaction.run(
            async () => {
                if (!acceptingInvitation)
                    await this.organization.requireMembership(this.actor(), organizationId);
                // All team mutations take the same organization lock before rechecking authority.
                const rows = await this.database.queryClient.$queryRaw<{ id: string }[]>`
                SELECT "id" FROM public."Organization" WHERE "id" = ${organizationId}::uuid AND "archivedAt" IS NULL FOR UPDATE`;
                if (!rows.length) throw new TeamError({ reason: 'forbidden' });
                return work();
            },
            { isolationLevel: 'ReadCommitted' }
        );
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
