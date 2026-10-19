import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import type { PermissionSubject } from '@/core/permission/index.js';
import { FacilityAccessService } from '../application/facility-access.service.js';
import { FacilityStorageReader } from '../infrastructure/persistence/facility-storage.reader.js';
import { FacilityStorageTopologyWriter } from './facility-storage-topology.writer.js';
import { FacilityError } from '../facility.error.js';
import { requireStorageCoordinates } from '../domain/storage-coordinates.js';
import { storageLocations } from '../infrastructure/persistence/storage-location.js';
export interface StorageRelocationInput {
    sourceFacilityId: string;
    sourceTopologyId: string;
    nodeId: string;
    targetFacilityId: string;
    targetTopologyId: string;
    parentId: string | null;
    sourceWorkspaceId?: string;
    targetWorkspaceId?: string;
    code?: string;
    rowIndex?: number | null;
    columnIndex?: number | null;
}
export type PreparedStorageRelocation = Awaited<ReturnType<FacilityRelocation['prepare']>>;
@Injectable()
export class FacilityRelocation {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly access: FacilityAccessService,
        private readonly facts: FacilityStorageReader,
        private readonly writer: FacilityStorageTopologyWriter
    ) {}
    async authorize(
        subject: PermissionSubject,
        organizationId: string,
        input: StorageRelocationInput
    ) {
        const source = await this.access.require(
            subject,
            { organizationId, workspaceId: input.sourceWorkspaceId },
            input.sourceFacilityId,
            'manage'
        );
        const target = await this.access.require(
            subject,
            { organizationId, workspaceId: input.targetWorkspaceId },
            input.targetFacilityId,
            'manage'
        );
        return { source, target };
    }
    async prepare(
        subject: PermissionSubject,
        organizationId: string,
        input: StorageRelocationInput,
        lock: boolean
    ) {
        const transaction = this.database.transaction.current();
        if (!transaction) throw new FacilityError({ reason: 'invalid-state' });
        const { source, target } = await this.authorize(subject, organizationId, input);
        if (source.facility.archivedAt || target.facility.archivedAt || target.facility.disabledAt)
            throw new FacilityError({ reason: 'invalid-state' });
        if (lock)
            for (const id of [...new Set([input.sourceTopologyId, input.targetTopologyId])].sort())
                await this.database.queryClient
                    .$queryRaw`SELECT id FROM "StorageTopology" WHERE id = ${id}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
        const layout = (id: string, facilityId: string) =>
            this.database.queryClient.storageTopology.findFirst({
                where: { id, facilityId, organizationId, archivedAt: null },
            });
        const sourceLayout = await layout(input.sourceTopologyId, input.sourceFacilityId);
        const targetLayout = await layout(input.targetTopologyId, input.targetFacilityId);
        if (!sourceLayout || !targetLayout) throw new FacilityError({ reason: 'forbidden' });
        const root = await this.facts.one(organizationId, sourceLayout.id, input.nodeId);
        if (root.kind !== 'CONTAINER' || root.effectiveArchived)
            throw new FacilityError({ reason: 'invalid-state' });
        const parent = input.parentId
            ? await this.facts.one(organizationId, targetLayout.id, input.parentId)
            : null;
        const row = input.rowIndex ?? null;
        const column = input.columnIndex ?? null;
        if (
            parent &&
            (parent.kind !== 'CONTAINER' || parent.effectiveArchived || parent.effectiveDisabled)
        )
            throw new FacilityError({ reason: 'invalid-state' });
        requireStorageCoordinates(parent, row, column);
        if (
            parent &&
            sourceLayout.id === targetLayout.id &&
            (parent.path === root.path || parent.path.startsWith(`${root.path}.`))
        )
            throw new FacilityError({ reason: 'invalid-input' });
        const nodes = await this.database.queryClient.$queryRaw<{ id: string }[]>`
            SELECT id FROM "StorageNode" WHERE "organizationId" = ${organizationId}::uuid AND "topologyId" = ${sourceLayout.id}::uuid
            AND path <@ ${root.path}::ltree ORDER BY id LIMIT 10001`;
        const grants = await this.database.queryClient.facilityWorkspaceAccess.findMany({
            where: { facilityId: { in: [...new Set([source.facility.id, target.facility.id])] } },
            orderBy: [{ facilityId: 'asc' }, { workspaceId: 'asc' }],
        });
        const locations = await storageLocations(this.database, organizationId, [
            root.id,
            ...(parent ? [parent.id] : []),
        ]);
        const sourceLocation = locations.get(root.id);
        const parentLocation = parent ? locations.get(parent.id) : null;
        if (!sourceLocation || (parent && !parentLocation))
            throw new Error('Relocation source or parent location is missing');
        const sourcePath = sourceLocation.path;
        const parentPath = parentLocation?.path ?? target.facility.name;
        return {
            organizationId,
            input,
            source: source.facility,
            target: target.facility,
            sourceLayout,
            targetLayout,
            root,
            nodes,
            grants,
            sourcePath,
            targetPath: `${parentPath} / ${root.name} [${input.code ?? root.code}]`,
            lock,
            transactionId: transaction.id,
        };
    }
    async requireWorkspaceAccess(organizationId: string, workspaceId: string, facilityId: string) {
        const facility = await this.database.queryClient.facility.findFirst({
            where: {
                id: facilityId,
                organizationId,
                archivedAt: null,
                disabledAt: null,
                OR: [
                    { managementWorkspaceId: workspaceId },
                    { workspaceAccess: { some: { workspaceId } } },
                ],
            },
            select: { id: true },
        });
        if (!facility) throw new FacilityError({ reason: 'forbidden' });
    }
    locations(organizationId: string, nodeIds: readonly string[]) {
        return storageLocations(this.database, organizationId, nodeIds);
    }
    async apply(prepared: PreparedStorageRelocation) {
        if (!prepared.lock || this.database.transaction.current()?.id !== prepared.transactionId)
            throw new FacilityError({ reason: 'invalid-state' });
        const { input, organizationId } = prepared;
        await this.writer.move({
            organizationId,
            topologyId: input.sourceTopologyId,
            targetTopologyId: input.targetTopologyId,
            nodeId: input.nodeId,
            parentId: input.parentId,
            code: input.code,
            rowIndex: input.rowIndex ?? undefined,
            columnIndex: input.columnIndex ?? undefined,
        });
        await this.database.queryClient.storageTopology.updateMany({
            where: { id: { in: [...new Set([input.sourceTopologyId, input.targetTopologyId])] } },
            data: { revision: { increment: 1 } },
        });
    }
}
