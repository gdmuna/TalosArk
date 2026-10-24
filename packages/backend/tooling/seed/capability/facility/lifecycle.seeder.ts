import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
    FacilityWriteSchema,
    FacilityStateSchema,
    FacilityGrantSchema,
    StorageNodeCreateSchema,
    StorageGridSchema,
    StorageNodeStateSchema,
    StorageNodeMoveSchema,
    StorageNodeReorderSchema,
} from '@talos-ark/contracts/facility';
import { FacilityService } from '../../../../src/modules/facility/application/facility.service.js';
import { StorageStructureService } from '../../../../src/modules/facility/application/storage-structure.service.js';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import { facilityLifecycleKind } from './lifecycle.kind.js';
import type { SeedExecution } from '../../runtime/execution.js';
import { type BusinessSeeder } from '../../runtime/handler.js';

@Injectable()
export class FacilityLifecycleSeeder implements BusinessSeeder<typeof facilityLifecycleKind> {
    constructor(
        private readonly facilities: FacilityService,
        private readonly structures: StorageStructureService,
        private readonly database: DatabaseRuntime
    ) {}
    async seed(
        data: z.output<typeof facilityLifecycleKind.data>,
        input: z.output<typeof facilityLifecycleKind.input>,
        execution: SeedExecution
    ) {
        const { facility } = input;
        const scope = facility.scope;
        for (const other of [input.secondary, input.empty])
            if (other.organizationId !== scope.organizationId)
                throw new Error('Facility grants must remain inside one organization');
        const facilities: Record<string, string> = {};
        const facilitySnapshot = (id: string) =>
            this.database.queryClient.facility.findUniqueOrThrow({
                where: { id },
                include: { workspaceAccess: { orderBy: { workspaceId: 'asc' } } },
            });
        for (const item of data.facilities)
            facilities[item.key] = await execution.record({
                key: `facility/${item.key}`,
                output: z.uuid(),
                create: async () => {
                    const request = {
                        ...item.input,
                        code: item.input.code ? `${execution.codePrefix}-${item.input.code}` : null,
                        managementWorkspaceId: scope.workspaceId,
                    } satisfies z.input<typeof FacilityWriteSchema>;
                    const row = await this.facilities.create(
                        scope.organizationId,
                        FacilityWriteSchema.parse(request)
                    );
                    if (item.state !== 'active') {
                        const state = {
                            expectedRevision: row.revision,
                            state: item.state,
                        } satisfies z.input<typeof FacilityStateSchema>;
                        await this.facilities.state(
                            scope.organizationId,
                            row.id,
                            FacilityStateSchema.parse(state)
                        );
                    }
                    return row.id;
                },
                inspect: facilitySnapshot,
            });
        for (const grant of data.grants)
            await execution.record({
                key: `grant/${grant.workspace}`,
                output: z.uuid(),
                create: async () => {
                    const current = await facilitySnapshot(facility.facilityId);
                    const request = {
                        expectedRevision: current.revision,
                        workspaceId: input[grant.workspace].workspaceId,
                        level: grant.level,
                    } satisfies z.input<typeof FacilityGrantSchema>;
                    await this.facilities.grant(
                        scope.organizationId,
                        facility.facilityId,
                        FacilityGrantSchema.parse(request)
                    );
                    return facility.facilityId;
                },
                inspect: facilitySnapshot,
            });
        const params = {
            organizationId: scope.organizationId,
            facilityId: facility.facilityId,
            topologyId: facility.topologyId,
        };
        const revision = async () =>
            (
                await this.database.queryClient.storageTopology.findUniqueOrThrow({
                    where: { id: facility.topologyId },
                    select: { revision: true },
                })
            ).revision;
        const nodeSnapshot = async (id: string) => {
            const rows = await this.database.queryClient.$queryRaw<
                unknown[]
            >`SELECT to_jsonb(n) AS node FROM public."StorageNode" n WHERE id = ${id}::uuid`;
            if (rows.length !== 1) throw new Error('Storage fixture disappeared');
            return rows[0];
        };
        const gridContainerId = await execution.record({
            key: 'grid-container',
            output: z.uuid(),
            create: async () => {
                const request = {
                    workspaceId: scope.workspaceId,
                    expectedRevision: await revision(),
                    parentId: null,
                    kind: 'CONTAINER',
                    code: `${execution.codePrefix}-GRID`,
                    name: 'Grid box',
                    containerType: 'BOX',
                    rowCount: 2,
                    columnCount: 3,
                } satisfies z.input<typeof StorageNodeCreateSchema>;
                return (
                    await this.structures.create(params, StorageNodeCreateSchema.parse(request))
                ).node.id;
            },
            inspect: nodeSnapshot,
        });
        const gridPositions = await execution.record({
            key: 'grid-positions',
            output: z.array(z.uuid()).length(6),
            create: async () => {
                const request = {
                    workspaceId: scope.workspaceId,
                    expectedRevision: await revision(),
                    positions: Array.from({ length: 6 }, (_, index) => ({
                        code: `${execution.codePrefix}-GRID-${index}`,
                        name: `Grid ${index + 1}`,
                        rowIndex: Math.floor(index / 3) + 1,
                        columnIndex: (index % 3) + 1,
                    })),
                } satisfies z.input<typeof StorageGridSchema>;
                await this.structures.grid(
                    { ...params, nodeId: gridContainerId },
                    StorageGridSchema.parse(request)
                );
                return (
                    await this.database.queryClient.storageNode.findMany({
                        where: { parentId: gridContainerId },
                        select: { id: true },
                        orderBy: [{ rowIndex: 'asc' }, { columnIndex: 'asc' }],
                    })
                ).map((row) => row.id);
            },
            inspect: async (ids) => {
                const nodes = [];
                for (const id of ids) nodes.push(await nodeSnapshot(id));
                return nodes;
            },
        });
        for (const [index, state] of (['disabled', 'archived'] as const).entries())
            await execution.record({
                key: `node-${state}`,
                output: z.uuid(),
                create: async () => {
                    const nodeId = gridPositions[index];
                    const request = {
                        workspaceId: scope.workspaceId,
                        expectedRevision: await revision(),
                        state,
                    } satisfies z.input<typeof StorageNodeStateSchema>;
                    await this.structures.state(
                        { ...params, nodeId },
                        StorageNodeStateSchema.parse(request)
                    );
                    return nodeId;
                },
                inspect: nodeSnapshot,
            });
        await execution.record({
            key: 'move-container',
            output: z.uuid(),
            create: async () => {
                const current = await revision();
                const request = {
                    workspaceId: scope.workspaceId,
                    expectedRevision: current,
                    targetRevision: current,
                    targetFacilityId: facility.facilityId,
                    targetTopologyId: facility.topologyId,
                    parentId: facility.containerId,
                    code: `${execution.codePrefix}-GRID`,
                } satisfies z.input<typeof StorageNodeMoveSchema>;
                await this.structures.move(
                    { ...params, nodeId: gridContainerId },
                    StorageNodeMoveSchema.parse(request)
                );
                return gridContainerId;
            },
            inspect: nodeSnapshot,
        });
        await execution.record({
            key: 'reorder-container',
            output: z.uuid(),
            create: async () => {
                const request = {
                    workspaceId: scope.workspaceId,
                    expectedRevision: await revision(),
                    beforeNodeId: facility.positions[0],
                } satisfies z.input<typeof StorageNodeReorderSchema>;
                await this.structures.reorder(
                    { ...params, nodeId: gridContainerId },
                    StorageNodeReorderSchema.parse(request)
                );
                return gridContainerId;
            },
            inspect: nodeSnapshot,
        });
        return { facilities, gridContainerId, gridPositions };
    }
}
