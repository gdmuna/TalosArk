import { Injectable } from '@nestjs/common';
import {
    ResourceExtension,
    type ResourceProvider,
    type ResourceLookup,
} from '@/core/resource/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { FacilityAccessService } from '../application/facility-access.service.js';
import { FacilityError } from '../facility.error.js';
import { AuthorizationError } from '@/core/authorization/index.js';

class StorageResourceProvider implements ResourceProvider {
    protected kind: 'FACILITY' | 'STORAGE_TOPOLOGY' | 'STORAGE_NODE' = 'FACILITY';
    constructor(
        protected readonly database: DatabaseRuntime,
        protected readonly access: FacilityAccessService
    ) {}
    async describe(input: ResourceLookup) {
        const context = input.accessContext;
        if (!context || input.expectedScope?.kind === 'workspace') return null;
        const workspaceId = context.kind === 'workspace' ? context.workspaceId : undefined;
        let target;
        if (this.kind === 'FACILITY') {
            const row = await this.database.queryClient.facility.findFirst({
                where: { resourceId: input.resourceId },
            });
            if (row) target = { ...row, facilityId: row.id };
        } else if (this.kind === 'STORAGE_TOPOLOGY') {
            target = await this.database.queryClient.storageTopology.findFirst({
                where: { resourceId: input.resourceId },
            });
        } else {
            const row = await this.database.queryClient.storageNode.findFirst({
                where: { resourceId: input.resourceId },
                include: { topology: { select: { facilityId: true } } },
            });
            if (row) target = { ...row, facilityId: row.topology.facilityId };
        }
        if (
            !target ||
            context.organizationId !== target.organizationId ||
            (input.expectedScope && input.expectedScope.organizationId !== target.organizationId)
        )
            return null;
        try {
            await this.access.require(
                input.subject,
                { organizationId: target.organizationId, workspaceId },
                target.facilityId
            );
        } catch (error) {
            if (error instanceof FacilityError || error instanceof AuthorizationError) return null;
            throw error;
        }
        const query = new URLSearchParams({
            organization: target.organizationId,
            ...(workspaceId ? { workspace: workspaceId } : {}),
        });
        if (this.kind !== 'FACILITY') {
            query.set('facility', target.facilityId);
            if (this.kind === 'STORAGE_NODE') query.set('node', target.id);
        }
        return {
            resourceId: input.resourceId,
            kind: this.kind,
            objectId: target.id,
            scope: { kind: 'organization' as const, organizationId: target.organizationId },
            label: target.name,
            href:
                this.kind === 'FACILITY'
                    ? `/main/management/facility/${target.id}?${query}`
                    : `/main/inventory/storage-topology?${query}`,
            archivedAt: target.archivedAt,
        };
    }
}
@Injectable()
@ResourceExtension({ kind: 'FACILITY' })
export class FacilityResourceProvider extends StorageResourceProvider {
    constructor(database: DatabaseRuntime, access: FacilityAccessService) {
        super(database, access);
    }
}
@Injectable()
@ResourceExtension({ kind: 'STORAGE_TOPOLOGY' })
export class TopologyResourceProvider extends StorageResourceProvider {
    protected kind = 'STORAGE_TOPOLOGY' as const;
    constructor(database: DatabaseRuntime, access: FacilityAccessService) {
        super(database, access);
    }
}
@Injectable()
@ResourceExtension({ kind: 'STORAGE_NODE' })
export class StorageNodeResourceProvider extends StorageResourceProvider {
    protected kind = 'STORAGE_NODE' as const;
    constructor(database: DatabaseRuntime, access: FacilityAccessService) {
        super(database, access);
    }
}
