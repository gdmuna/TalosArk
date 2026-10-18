import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
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
        return this.database.transaction.run(
            async () => {
                const value = parseStorageNodeInput(storageNodeCreateSchema, input);
                await this.database.queryClient.$executeRaw`
                    INSERT INTO public."StorageNode" (
                        id, "organizationId", "topologyId", "resourceId", "parentId",
                        code, name, kind, "rowIndex", "columnIndex", "sortOrder", "updatedAt"
                    ) VALUES (
                        ${value.id}::uuid, ${value.organizationId}::uuid, ${value.topologyId}::uuid,
                        ${value.resourceId}::uuid, ${value.parentId}::uuid, ${value.code}, ${value.name},
                        ${value.kind}::public."StorageNodeKind", ${value.rowIndex ?? null},
                        ${value.columnIndex ?? null}, ${value.sortOrder}, CURRENT_TIMESTAMP
                    )
                `;
            },
            { propagation: 'mandatory' }
        );
    }

    move(input: StorageNodeMoveInput): Promise<void> {
        return this.database.transaction.run(
            async () => {
                const value = parseStorageNodeInput(storageNodeMoveSchema, input);
                await this.database.queryClient.$executeRaw`
                    SELECT public.storage_node_move(
                        ${value.organizationId}::uuid, ${value.topologyId}::uuid,
                        ${value.nodeId}::uuid, ${value.parentId}::uuid
                    )
                `;
            },
            { propagation: 'mandatory' }
        );
    }
}
