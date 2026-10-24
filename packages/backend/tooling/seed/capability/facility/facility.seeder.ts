import { Injectable } from '@nestjs/common';
import { FacilityWriteSchema, StorageNodeCreateSchema } from '@talos-ark/contracts/facility';
import type { z } from 'zod';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import { FacilityService } from '../../../../src/modules/facility/application/facility.service.js';
import { StorageStructureService } from '../../../../src/modules/facility/application/storage-structure.service.js';
import { facilityKind } from './facility.kind.js';
import type { SeedExecution } from '../../runtime/execution.js';
import { z as schema } from 'zod';
import { type BusinessSeeder } from '../../runtime/handler.js';

@Injectable()
export class FacilitySeeder implements BusinessSeeder<typeof facilityKind> {
    constructor(
        private readonly facilities: FacilityService,
        private readonly structures: StorageStructureService,
        private readonly database: DatabaseRuntime
    ) {}

    async seed(
        data: z.infer<typeof facilityKind.data>,
        scope: z.infer<typeof facilityKind.input>,
        execution: SeedExecution
    ): Promise<z.infer<typeof facilityKind.output>> {
        const reference = await execution.record({
            key: 'facility',
            output: facilityKind.output.pick({ facilityId: true, topologyId: true }),
            create: async () => {
                const request = {
                    code: `${execution.codePrefix}-CABINET`,
                    name: data.name,
                    managementWorkspaceId: scope.workspaceId,
                } satisfies z.input<typeof FacilityWriteSchema>;
                const facility = await this.facilities.create(
                    scope.organizationId,
                    FacilityWriteSchema.parse(request)
                );
                const topology = await this.database.queryClient.storageTopology.findFirstOrThrow({
                    where: { facilityId: facility.id, archivedAt: null },
                    select: { id: true },
                });
                return { facilityId: facility.id, topologyId: topology.id };
            },
            inspect: async ({ facilityId, topologyId }) => {
                await this.facilities.detail(scope, facilityId);
                return {
                    facility: await this.database.queryClient.facility.findUniqueOrThrow({
                        where: { id: facilityId },
                        select: {
                            id: true,
                            organizationId: true,
                            managementWorkspaceId: true,
                            resourceId: true,
                            code: true,
                            name: true,
                            archivedAt: true,
                            disabledAt: true,
                            revision: true,
                        },
                    }),
                    topology: await this.database.queryClient.storageTopology.findUniqueOrThrow({
                        where: { id: topologyId },
                        select: {
                            id: true,
                            organizationId: true,
                            facilityId: true,
                            resourceId: true,
                            name: true,
                            archivedAt: true,
                        },
                    }),
                };
            },
        });
        const params = { organizationId: scope.organizationId, ...reference };
        const node = async (key: string, parentId: string | null, kind: 'CONTAINER' | 'POSITION') =>
            execution.record({
                key,
                output: schema.uuid(),
                create: async () => {
                    const topology =
                        await this.database.queryClient.storageTopology.findUniqueOrThrow({
                            where: { id: reference.topologyId },
                            select: { revision: true },
                        });
                    const request = {
                        workspaceId: scope.workspaceId,
                        expectedRevision: topology.revision,
                        parentId,
                        kind,
                        code: `${execution.codePrefix}-${key}`,
                        name: key,
                        containerType: kind === 'CONTAINER' ? 'CABINET' : null,
                    } satisfies z.input<typeof StorageNodeCreateSchema>;
                    const result = await this.structures.create(
                        params,
                        StorageNodeCreateSchema.parse(request)
                    );
                    return result.node.id;
                },
                inspect: async (id: string) => {
                    await this.structures.detail({
                        ...params,
                        nodeId: id,
                        workspaceId: scope.workspaceId,
                    });
                    const rows = await this.database.queryClient.$queryRaw<unknown[]>`
                    SELECT to_jsonb(n) - 'createdAt' - 'updatedAt' AS node
                    FROM public."StorageNode" n WHERE id = ${id}::uuid`;
                    if (rows.length !== 1) throw new Error(`Storage node ${id} disappeared`);
                    return rows[0];
                },
            });
        const containerId = await node('cabinet', null, 'CONTAINER');
        const positions: string[] = [];
        for (let index = 0; index < data.positions; index++)
            positions.push(await node(`position-${index + 1}`, containerId, 'POSITION'));
        return { scope, ...reference, containerId, positions };
    }
}
