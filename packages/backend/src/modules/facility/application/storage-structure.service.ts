import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
    StorageNodeDetailSchema,
    StorageNodePageSchema,
    type StorageParams,
    type StorageNodeParams,
    type StorageQuery,
    type StorageNodeCreate,
    type StorageNodeUpdate,
    type StorageNodeState,
    type StorageNodeMove,
    type StorageGrid,
    type StorageNodeReorder,
} from '@talos-ark/contracts/facility';
import { FacilityOperations } from './facility.operations.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { ResourceKernel } from '@/core/resource/index.js';
import { FacilityAccessService } from './facility-access.service.js';
import {
    FacilityStorageReader,
    type StorageFact,
} from '../infrastructure/persistence/facility-storage.reader.js';
import { FacilityStorageTopologyWriter } from '../public/facility-storage-topology.writer.js';
import { FacilityError } from '../facility.error.js';
import { requireStorageCoordinates } from '../domain/storage-coordinates.js';

type Context = StorageParams & { workspaceId?: string };
@Injectable()
export class StorageStructureService {
    constructor(
        private readonly operations: FacilityOperations,
        private readonly database: DatabaseRuntime,
        private readonly access: FacilityAccessService,
        private readonly resources: ResourceKernel,
        private readonly facts: FacilityStorageReader,
        private readonly writer: FacilityStorageTopologyWriter
    ) {}

    private async layout(input: StorageParams, expectedRevision?: number) {
        const layout = await this.database.queryClient.storageTopology.findFirst({
            where: {
                id: input.topologyId,
                organizationId: input.organizationId,
                facilityId: input.facilityId,
                archivedAt: null,
            },
        });
        if (!layout) throw new FacilityError({ reason: 'forbidden' });
        if (expectedRevision !== undefined && expectedRevision !== layout.revision)
            throw new FacilityError({ reason: 'conflict' });
        return layout;
    }
    private async lock(input: StorageParams, expectedRevision: number) {
        await this.database.queryClient
            .$queryRaw`SELECT id FROM "StorageTopology" WHERE id = ${input.topologyId}::uuid AND "organizationId" = ${input.organizationId}::uuid FOR UPDATE`;
        return this.layout(input, expectedRevision);
    }
    private async bump(topologyId: string) {
        return (
            await this.database.queryClient.storageTopology.update({
                where: { id: topologyId },
                data: { revision: { increment: 1 } },
                select: { revision: true },
            })
        ).revision;
    }
    list(input: Context, query: StorageQuery) {
        return this.operations.read(async () => {
            const { facility, capabilities } = await this.access.require(
                this.operations.subject(),
                input,
                input.facilityId,
                query.mode === 'positions' ? 'use' : 'read'
            );
            const topology = await this.layout(input);
            if (query.parentId)
                await this.facts.one(input.organizationId, input.topologyId, query.parentId);
            const page = await this.facts.page(
                input.organizationId,
                input.topologyId,
                query,
                topology.revision,
                !facility.archivedAt && !facility.disabledAt && capabilities.use
            );
            return StorageNodePageSchema.parse({
                ...page,
                items: page.items.map((node) => this.facts.view(node, facility, capabilities)),
                revision: topology.revision,
            });
        });
    }
    detail(input: Context & { nodeId: string }) {
        return this.operations.read(async () => {
            const { facility, capabilities } = await this.access.require(
                this.operations.subject(),
                input,
                input.facilityId
            );
            const topology = await this.layout(input);
            const node = await this.facts.one(input.organizationId, input.topologyId, input.nodeId);
            return StorageNodeDetailSchema.parse({
                node: this.facts.view(node, facility, capabilities),
                revision: topology.revision,
                ancestors: await this.facts.ancestors(node),
                capabilities,
            });
        });
    }
    private shape(
        kind: StorageFact['kind'],
        body: Pick<StorageNodeUpdate, 'containerType' | 'rowCount' | 'columnCount'>
    ) {
        if (
            (body.rowCount === null) !== (body.columnCount === null) ||
            (kind === 'POSITION' && (body.containerType !== null || body.rowCount !== null))
        )
            throw new FacilityError({ reason: 'invalid-input' });
    }
    private async parent(
        input: StorageParams,
        parentId: string | null,
        row: number | null,
        column: number | null
    ) {
        if (!parentId) {
            requireStorageCoordinates(null, row, column);
            return null;
        }
        const parent = await this.facts.one(input.organizationId, input.topologyId, parentId);
        if (parent.kind !== 'CONTAINER' || parent.effectiveArchived)
            throw new FacilityError({ reason: 'invalid-state' });
        requireStorageCoordinates(parent, row, column);
        return parent;
    }
    private fields(body: StorageNodeUpdate | StorageNodeCreate) {
        return {
            code: body.code,
            name: body.name,
            description: body.description,
            containerType: body.containerType,
            rowCount: body.rowCount,
            columnCount: body.columnCount,
            rowIndex: body.rowIndex,
            columnIndex: body.columnIndex,
        };
    }
    private async nextOrder(topologyId: string, parentId: string | null) {
        const maximum = await this.database.queryClient.storageNode.aggregate({
            where: { topologyId, parentId },
            _max: { sortOrder: true },
        });
        return (maximum._max.sortOrder ?? -1) + 1;
    }
    private async createOne(input: Context, body: StorageNodeCreate) {
        this.shape(body.kind, body);
        await this.parent(input, body.parentId, body.rowIndex, body.columnIndex);
        const resource = await this.resources.create({
            organizationId: input.organizationId,
            kind: 'STORAGE_NODE',
        });
        const nodeId = randomUUID();
        await this.writer.create({
            id: nodeId,
            organizationId: input.organizationId,
            topologyId: input.topologyId,
            resourceId: resource.id,
            parentId: body.parentId,
            code: body.code,
            name: body.name,
            kind: body.kind,
            description: body.description ?? undefined,
            containerType: body.containerType ?? undefined,
            rowIndex: body.rowIndex ?? undefined,
            columnIndex: body.columnIndex ?? undefined,
            rowCount: body.rowCount ?? undefined,
            columnCount: body.columnCount ?? undefined,
            sortOrder: await this.nextOrder(input.topologyId, body.parentId),
        });
        return nodeId;
    }
    create(params: StorageParams, body: StorageNodeCreate) {
        const input = { ...params, workspaceId: body.workspaceId };
        return this.operations.write(input, input.facilityId, 'manage', async ({ facility }) => {
            if (facility.archivedAt) throw new FacilityError({ reason: 'invalid-state' });
            await this.lock(input, body.expectedRevision);
            const nodeId = await this.createOne(input, body);
            await this.bump(input.topologyId);
            await this.operations.record(
                input,
                'storage.create',
                facility.resourceId,
                facility.name,
                { nodeId, parentId: body.parentId }
            );
            return this.detail({ ...input, nodeId });
        });
    }
    update(params: StorageNodeParams, body: StorageNodeUpdate) {
        const input = { ...params, workspaceId: body.workspaceId };
        return this.operations.write(input, input.facilityId, 'manage', async ({ facility }) => {
            if (facility.archivedAt) throw new FacilityError({ reason: 'invalid-state' });
            await this.lock(input, body.expectedRevision);
            const node = await this.facts.one(input.organizationId, input.topologyId, input.nodeId);
            if (node.effectiveArchived) throw new FacilityError({ reason: 'invalid-state' });
            this.shape(node.kind, body);
            await this.parent(input, node.parentId, body.rowIndex, body.columnIndex);
            const children = await this.database.queryClient.storageNode.findFirst({
                where: {
                    parentId: node.id,
                    OR:
                        body.rowCount !== null && body.columnCount !== null
                            ? [
                                  { rowIndex: null },
                                  { rowIndex: { gt: body.rowCount } },
                                  { columnIndex: { gt: body.columnCount } },
                              ]
                            : [{ rowIndex: { not: null } }],
                },
                select: { id: true },
            });
            if (children) throw new FacilityError({ reason: 'invalid-input' });
            if (
                (node.rowIndex !== body.rowIndex || node.columnIndex !== body.columnIndex) &&
                (await this.facts.occupied(node))
            )
                throw new FacilityError({ reason: 'occupied' });
            await this.database.queryClient.storageNode.update({
                where: { id: node.id },
                data: {
                    ...this.fields(body),
                    containerType:
                        node.kind === 'CONTAINER' ? (body.containerType ?? 'OTHER') : null,
                },
            });
            await this.bump(input.topologyId);
            await this.operations.record(input, 'storage.update', node.resourceId, body.name, {
                nodeId: node.id,
            });
            return this.detail(input);
        });
    }
    state(params: StorageNodeParams, body: StorageNodeState) {
        const input = { ...params, workspaceId: body.workspaceId };
        return this.operations.write(input, input.facilityId, 'manage', async ({ facility }) => {
            if (facility.archivedAt) throw new FacilityError({ reason: 'invalid-state' });
            await this.lock(input, body.expectedRevision);
            const node = await this.facts.one(input.organizationId, input.topologyId, input.nodeId);
            if (body.state === 'archived') {
                if (await this.facts.occupied(node))
                    throw new FacilityError({ reason: 'occupied' });
                if (node.hasChildren) throw new FacilityError({ reason: 'invalid-state' });
            } else await this.parent(input, node.parentId, node.rowIndex, node.columnIndex);
            await this.database.queryClient.storageNode.update({
                where: { id: node.id },
                data: {
                    archivedAt: body.state === 'archived' ? new Date() : null,
                    disabledAt: body.state === 'disabled' ? new Date() : null,
                },
            });
            const revision = await this.bump(input.topologyId);
            await this.operations.record(input, 'storage.state', node.resourceId, node.name, {
                nodeId: node.id,
                state: body.state,
            });
            return { revision };
        });
    }
    grid(params: StorageNodeParams, body: StorageGrid) {
        const input = { ...params, workspaceId: body.workspaceId };
        return this.operations.write(input, input.facilityId, 'manage', async ({ facility }) => {
            if (facility.archivedAt) throw new FacilityError({ reason: 'invalid-state' });
            await this.lock(input, body.expectedRevision);
            const parent = await this.facts.one(
                input.organizationId,
                input.topologyId,
                input.nodeId
            );
            if (
                parent.kind !== 'CONTAINER' ||
                parent.effectiveArchived ||
                parent.rowCount === null ||
                parent.columnCount === null
            )
                throw new FacilityError({ reason: 'invalid-state' });
            const codes = new Set<string>();
            const coordinates = new Set<string>();
            for (const item of body.positions) {
                const coordinate = `${item.rowIndex}:${item.columnIndex}`;
                if ((item.code && codes.has(item.code)) || coordinates.has(coordinate))
                    throw new FacilityError({ reason: 'code-conflict' });
                if (item.code) codes.add(item.code);
                coordinates.add(coordinate);
                if (item.rowIndex > parent.rowCount || item.columnIndex > parent.columnCount)
                    throw new FacilityError({ reason: 'invalid-input' });
            }
            const resources = await this.resources.createBatch(
                { organizationId: input.organizationId, kind: 'STORAGE_NODE' },
                body.positions.length
            );
            const firstOrder = await this.nextOrder(input.topologyId, input.nodeId);
            await this.writer.createMany(
                body.positions.map((item, index) => ({
                    id: randomUUID(),
                    organizationId: input.organizationId,
                    topologyId: input.topologyId,
                    resourceId: resources[index].id,
                    parentId: input.nodeId,
                    kind: 'POSITION',
                    code: item.code,
                    name: item.name,
                    rowIndex: item.rowIndex,
                    columnIndex: item.columnIndex,
                    sortOrder: firstOrder + index,
                }))
            );
            const revision = await this.bump(input.topologyId);
            await this.operations.record(
                input,
                'storage.grid',
                facility.resourceId,
                facility.name,
                { parentId: input.nodeId, count: body.positions.length }
            );
            return { revision };
        });
    }
    move(params: StorageNodeParams, body: StorageNodeMove) {
        const input = { ...params, workspaceId: body.workspaceId };
        const target = {
            ...input,
            facilityId: body.targetFacilityId,
            topologyId: body.targetTopologyId,
        };
        return this.operations.write(input, input.facilityId, 'manage', async ({ facility }) => {
            const destination = await this.access.require(
                this.operations.subject(),
                target,
                target.facilityId,
                'manage'
            );
            if (facility.archivedAt || destination.facility.archivedAt)
                throw new FacilityError({ reason: 'invalid-state' });
            for (const topologyId of [...new Set([input.topologyId, target.topologyId])].sort())
                await this.database.queryClient
                    .$queryRaw`SELECT id FROM "StorageTopology" WHERE id = ${topologyId}::uuid AND "organizationId" = ${input.organizationId}::uuid FOR UPDATE`;
            await this.layout(input, body.expectedRevision);
            await this.layout(target, body.targetRevision);
            const node = await this.facts.one(input.organizationId, input.topologyId, input.nodeId);
            if (node.effectiveArchived) throw new FacilityError({ reason: 'invalid-state' });
            const parent = await this.parent(
                target,
                body.parentId,
                body.rowIndex,
                body.columnIndex
            );
            if (
                parent &&
                input.topologyId === target.topologyId &&
                (parent.path === node.path || parent.path.startsWith(`${node.path}.`))
            )
                throw new FacilityError({ reason: 'invalid-input' });
            if (await this.facts.occupied(node)) throw new FacilityError({ reason: 'occupied' });
            await this.writer.move({
                organizationId: input.organizationId,
                topologyId: input.topologyId,
                targetTopologyId: target.topologyId,
                nodeId: node.id,
                parentId: body.parentId,
                code: body.code,
                rowIndex: body.rowIndex ?? undefined,
                columnIndex: body.columnIndex ?? undefined,
            });
            const sourceRevision = await this.bump(input.topologyId);
            const targetRevision =
                input.topologyId === target.topologyId
                    ? sourceRevision
                    : await this.bump(target.topologyId);
            await this.operations.record(input, 'storage.move', node.resourceId, node.name, {
                nodeId: node.id,
                fromFacilityId: input.facilityId,
                toFacilityId: target.facilityId,
                fromTopologyId: input.topologyId,
                toTopologyId: target.topologyId,
                fromPath: node.path,
                toPath: (await this.facts.one(input.organizationId, target.topologyId, node.id))
                    .path,
                parentId: body.parentId,
            });
            return { sourceRevision, targetRevision };
        });
    }
    reorder(params: StorageNodeParams, body: StorageNodeReorder) {
        const input = { ...params, workspaceId: body.workspaceId };
        return this.operations.write(input, input.facilityId, 'manage', async ({ facility }) => {
            if (facility.archivedAt) throw new FacilityError({ reason: 'invalid-state' });
            await this.lock(input, body.expectedRevision);
            const node = await this.facts.one(input.organizationId, input.topologyId, input.nodeId);
            if (node.effectiveArchived || body.beforeNodeId === node.id)
                throw new FacilityError({ reason: 'invalid-input' });
            const before = body.beforeNodeId
                ? await this.facts.one(input.organizationId, input.topologyId, body.beforeNodeId)
                : null;
            if (before && (before.parentId !== node.parentId || before.effectiveArchived))
                throw new FacilityError({ reason: 'invalid-input' });
            const order =
                before?.sortOrder ?? (await this.nextOrder(input.topologyId, node.parentId));
            await this.database.queryClient.storageNode.updateMany({
                where: {
                    topologyId: input.topologyId,
                    parentId: node.parentId,
                    id: { not: node.id },
                    sortOrder: { gte: order },
                },
                data: { sortOrder: { increment: 1 } },
            });
            await this.database.queryClient.storageNode.update({
                where: { id: node.id },
                data: { sortOrder: order },
            });
            const revision = await this.bump(input.topologyId);
            await this.operations.record(input, 'storage.reorder', node.resourceId, node.name, {
                nodeId: node.id,
                beforeNodeId: body.beforeNodeId,
            });
            return { revision };
        });
    }
}
