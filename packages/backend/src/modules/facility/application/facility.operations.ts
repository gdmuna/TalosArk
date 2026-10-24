import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationWriteKernel } from '@/core/organization-write/index.js';
import { AuditKernel, type AuditValue } from '@/core/audit/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { FacilityAccessService, type FacilityContext } from './facility-access.service.js';
import { facilityErrors } from './facility.error.mapper.js';

@Injectable()
export class FacilityOperations {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly writes: OrganizationWriteKernel,
        private readonly access: FacilityAccessService,
        private readonly audit: AuditKernel,
        private readonly actor: AlsContextAdapter
    ) {}
    subject() {
        return { kind: 'user' as const, userId: this.actor.requireActor().userId };
    }
    read<T>(work: () => Promise<T>) {
        return this.database.transaction.run(
            work,
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }
    write<T>(
        context: FacilityContext,
        facilityId: string,
        action: 'manage' | 'govern',
        execute: (access: Awaited<ReturnType<FacilityAccessService['require']>>) => Promise<T>
    ) {
        return facilityErrors.run(() =>
            this.writes.run({
                organizationId: context.organizationId,
                authorize: () => this.access.require(this.subject(), context, facilityId, action),
                execute,
            })
        );
    }
    record(
        context: FacilityContext,
        action: string,
        resourceId: string,
        label: string,
        details: Record<string, AuditValue>
    ) {
        return this.audit.record({
            organizationId: context.organizationId,
            workspaceId: context.workspaceId,
            actorUserId: this.subject().userId,
            action,
            occurredAt: new Date(),
            requestId: this.actor.get()?.requestId,
            resources: [{ resourceId, labelSnapshot: label }],
            details,
        });
    }
}
