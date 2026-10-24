import { Injectable } from '@nestjs/common';
import { Prisma } from '@root/prisma/generated/client.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { FacilityError } from '../../facility.error.js';
import type { FacilityStorageTopologyWriter } from '../../public/facility-storage-topology.writer.js';
import type {
    StorageNodeMoveInput,
    StorageNodeMutationInput,
} from '../../public/facility-storage-topology.contract.js';
import {
    parseStorageNodeInput,
    storageNodeCreateSchema,
    storageNodeMoveSchema,
} from './storage-node.input.js';

@Injectable()
export class StorageNodeWriter implements FacilityStorageTopologyWriter {
    constructor(private readonly database: DatabaseRuntime) {}

    create(input: StorageNodeMutationInput): Promise<void> {
        return this.createMany([input]);
    }

    createMany(input: readonly StorageNodeMutationInput[]): Promise<void> {
        return this.database.transaction.run(
            async () => {
                if (input.length < 1 || input.length > 1000)
                    throw new FacilityError({ reason: 'invalid-input' });
                if (
                    input.some(
                        (item) =>
                            item.organizationId !== input[0].organizationId ||
                            item.topologyId !== input[0].topologyId ||
                            item.parentId !== input[0].parentId
                    )
                )
                    throw new FacilityError({ reason: 'invalid-input' });
                const rows = input.map((item) => {
                    const value = parseStorageNodeInput(storageNodeCreateSchema, item);
                    return Prisma.sql`(
                        ${value.id}::uuid, ${value.organizationId}::uuid, ${value.topologyId}::uuid,
                        ${value.resourceId}::uuid, ${value.parentId}::uuid, ${value.code ?? null}, ${value.name},
                        ${value.kind}::public."StorageNodeKind", ${value.rowIndex ?? null},
                        ${value.columnIndex ?? null}, ${value.sortOrder}, CURRENT_TIMESTAMP,
                        ${value.kind === 'CONTAINER' ? (value.containerType ?? 'OTHER') : null}::public."StorageContainerType",
                        ${value.description ?? null}, ${value.rowCount ?? null}, ${value.columnCount ?? null}
                    )`;
                });
                await this.database.queryClient.$executeRaw(Prisma.sql`
                    INSERT INTO public."StorageNode" (
                        id, "organizationId", "topologyId", "resourceId", "parentId",
                        code, name, kind, "rowIndex", "columnIndex", "sortOrder", "updatedAt",
                        "containerType", description, "rowCount", "columnCount"
                    ) VALUES ${Prisma.join(rows)}
                `);
            },
            { propagation: 'mandatory' }
        );
    }

    move(input: StorageNodeMoveInput): Promise<void> {
        return this.database.transaction.run(
            async () => {
                const value = parseStorageNodeInput(storageNodeMoveSchema, input);
                // Omission preserves the code; explicit null clears it in the native move.
                const code =
                    value.code === undefined
                        ? Prisma.sql`(SELECT code FROM public."StorageNode" WHERE id = ${value.nodeId}::uuid AND "organizationId" = ${value.organizationId}::uuid AND "topologyId" = ${value.topologyId}::uuid)`
                        : value.code;
                await this.database.queryClient.$executeRaw`
                    SELECT public.storage_node_move(
                        ${value.organizationId}::uuid, ${value.topologyId}::uuid, ${value.targetTopologyId}::uuid,
                        ${value.nodeId}::uuid, ${value.parentId}::uuid, ${code},
                        ${value.rowIndex ?? null}, ${value.columnIndex ?? null}
                    )
                `;
            },
            { propagation: 'mandatory' }
        );
    }
}
