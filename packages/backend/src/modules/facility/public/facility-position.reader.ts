import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import type { PermissionSubject } from '@/core/permission/index.js';
import { FacilityAccessService } from '../application/facility-access.service.js';
import { FacilityStorageReader } from '../infrastructure/persistence/facility-storage.reader.js';
import { FacilityError } from '../facility.error.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { facilityPermission } from '../contribution/facility-authorization.contribution.js';
import {
    storageLocations,
    type StorageLocation,
} from '../infrastructure/persistence/storage-location.js';

export interface FacilityPositionLookup {
    subject: PermissionSubject;
    organizationId: string;
    workspaceId: string;
    facilityId: string;
    topologyId: string;
    nodeId: string;
}
@Injectable()
export class FacilityPositionReader {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly access: FacilityAccessService,
        private readonly facts: FacilityStorageReader,
        private readonly authorization: AuthorizationKernel
    ) {}
    /** Observation only. Inventory must call after its organization write lock and recheck on commit. */
    requireAvailable(input: FacilityPositionLookup) {
        return this.database.transaction.run(
            async () => {
                const { facility, capabilities } = await this.access.require(
                    input.subject,
                    input,
                    input.facilityId,
                    'use'
                );
                const topology = await this.database.queryClient.storageTopology.findFirst({
                    where: {
                        id: input.topologyId,
                        facilityId: input.facilityId,
                        organizationId: input.organizationId,
                        archivedAt: null,
                    },
                    select: { id: true },
                });
                if (!topology) throw new FacilityError({ reason: 'forbidden' });
                const node = this.facts.view(
                    await this.facts.one(input.organizationId, input.topologyId, input.nodeId),
                    facility,
                    capabilities
                );
                if (!node.usable)
                    throw new FacilityError({
                        reason: node.occupied ? 'occupied' : 'invalid-state',
                    });
                const locations = await storageLocations(this.database, input.organizationId, [
                    node.id,
                ]);
                const location = locations.get(node.id);
                if (!location) throw new Error('Available position has no location');
                return { ...node, location };
            },
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }
    async describeMany(
        subject: PermissionSubject,
        input: { organizationId: string; workspaceId: string; nodeIds: readonly string[] }
    ) {
        if (!input.nodeIds.length) return new Map<string, StorageLocation>();
        const decision = await this.authorization.check({
            subject,
            target: {
                kind: 'workspace',
                organizationId: input.organizationId,
                workspaceId: input.workspaceId,
            },
            permissionCode: facilityPermission.read,
        });
        if (!decision.allowed) return new Map<string, StorageLocation>();
        const access = await this.access.scope(subject, input);
        const nodes = await this.database.queryClient.storageNode.findMany({
            where: {
                organizationId: input.organizationId,
                id: { in: [...input.nodeIds] },
                topology: { facility: access.where },
            },
            select: { id: true },
        });
        return storageLocations(
            this.database,
            input.organizationId,
            nodes.map((node) => node.id)
        );
    }
}
