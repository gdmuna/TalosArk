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
export interface FacilitySourcePosition extends StorageLocation {
    writable: boolean;
}
@Injectable()
export class FacilityPositionReader {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly access: FacilityAccessService,
        private readonly facts: FacilityStorageReader,
        private readonly authorization: AuthorizationKernel
    ) {}
    /** Trusted inventory facts, never a user-facing location projection. */
    async inspectSources(input: { organizationId: string; nodeIds: readonly string[] }) {
        const transaction = this.database.transaction.current();
        if (!transaction || transaction.state !== 'active' || transaction.rollbackOnly)
            throw new Error('Source position inspection requires an active managed transaction');
        const ids = [...new Set(input.nodeIds)];
        const result = new Map<string, FacilitySourcePosition>();
        if (!ids.length) return result;
        const nodes = await this.facts.many(input.organizationId, ids);
        const topologies = await this.database.queryClient.storageTopology.findMany({
            where: {
                organizationId: input.organizationId,
                id: { in: [...new Set(nodes.map((n) => n.topologyId))] },
            },
            include: { facility: true },
        });
        const layouts = new Map(topologies.map((layout) => [layout.id, layout]));
        const locations = await storageLocations(this.database, input.organizationId, ids);
        for (const node of nodes) {
            const topology = layouts.get(node.topologyId);
            const location = locations.get(node.id);
            if (!topology || !location || node.kind !== 'POSITION')
                throw new Error('Inventory placement has inconsistent storage facts');
            result.set(node.id, {
                ...location,
                writable:
                    !topology.archivedAt &&
                    !topology.facility.archivedAt &&
                    !topology.facility.disabledAt &&
                    !node.effectiveArchived &&
                    !node.effectiveDisabled,
            });
        }
        if (result.size !== ids.length)
            throw new Error('Inventory placement references a missing position');
        return result;
    }

    private async authorizedFacilities(
        subject: PermissionSubject,
        scope: { organizationId: string; workspaceId: string },
        facilityIds: readonly string[],
        action: 'read' | 'use'
    ) {
        if (!facilityIds.length) return new Set<string>();
        const decision = await this.authorization.check({
            subject,
            target: { kind: 'workspace', ...scope },
            permissionCode: facilityPermission.read,
        });
        if (!decision.allowed) return new Set<string>();
        const access = await this.access.scope(subject, scope);
        if (!access.capabilities[action]) return new Set<string>();
        const rows = await this.database.queryClient.facility.findMany({
            where: { AND: [access.where, { id: { in: [...new Set(facilityIds)] } }] },
            select: { id: true },
        });
        return new Set(rows.map((row) => row.id));
    }

    visibleFacilities(
        subject: PermissionSubject,
        scope: { organizationId: string; workspaceId: string },
        facilityIds: readonly string[]
    ) {
        return this.authorizedFacilities(subject, scope, facilityIds, 'read');
    }

    usableFacilities(
        subject: PermissionSubject,
        scope: { organizationId: string; workspaceId: string },
        facilityIds: readonly string[]
    ) {
        return this.authorizedFacilities(subject, scope, facilityIds, 'use');
    }

    async requireUse(
        subject: PermissionSubject,
        scope: { organizationId: string; workspaceId: string },
        facilityIds: readonly string[]
    ) {
        const ids = [...new Set(facilityIds)];
        const allowed = await this.usableFacilities(subject, scope, ids);
        if (ids.some((id) => !allowed.has(id))) throw new FacilityError({ reason: 'forbidden' });
    }
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
