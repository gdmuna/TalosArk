import type { Prisma, StorageNodeKind } from '@root/prisma/generated/client.js';

export interface CreateStorageNodeInput {
    id: string;
    organizationId: string;
    topologyId: string;
    resourceId: string;
    parentId: string | null;
    code: string;
    name: string;
    kind: StorageNodeKind;
    rowIndex?: number;
    columnIndex?: number;
    sortOrder?: number;
}

/** Caller creates the resource identity and checks permissions in the same transaction. */
export async function createStorageNode(
    transaction: Prisma.TransactionClient,
    input: CreateStorageNodeInput
): Promise<void> {
    // The trigger locks the topology and derives path; no caller-supplied path.
    await transaction.$executeRaw`
        INSERT INTO public."StorageNode" (
            id, "organizationId", "topologyId", "resourceId", "parentId",
            code, name, kind, "rowIndex", "columnIndex", "sortOrder", "updatedAt"
        ) VALUES (
            ${input.id}::uuid, ${input.organizationId}::uuid, ${input.topologyId}::uuid,
            ${input.resourceId}::uuid, ${input.parentId}::uuid, ${input.code}, ${input.name},
            ${input.kind}::public."StorageNodeKind", ${input.rowIndex ?? null},
            ${input.columnIndex ?? null}, ${input.sortOrder ?? 0}, CURRENT_TIMESTAMP
        )
    `;
}

/** Changes the parent and every descendant path atomically; never rewrites inventory history. */
export async function moveStorageNode(
    transaction: Prisma.TransactionClient,
    input: { organizationId: string; topologyId: string; nodeId: string; parentId: string | null }
): Promise<void> {
    await transaction.$executeRaw`
        SELECT public.storage_node_move(
            ${input.organizationId}::uuid, ${input.topologyId}::uuid,
            ${input.nodeId}::uuid, ${input.parentId}::uuid
        )
    `;
}
