import { Injectable } from '@nestjs/common';
import { Prisma } from '@root/prisma/generated/client.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import type { FacilityStorageTopologyReader } from '../../public/facility-storage-topology.reader.js';
import type {
    StorageNodeChildrenInput,
    StorageNodeCursorPage,
    StorageNodeDescendantsInput,
    StorageNodeFact,
    StorageNodeLookup,
} from '../../public/facility-storage-topology.contract.js';
import {
    decodeStorageNodeCursor,
    encodeStorageNodeCursor,
    storageNodeQueryKey,
    type StorageNodeCursorOrder,
} from './storage-node.cursor.js';
import {
    parseStorageNodeInput,
    storageNodeChildrenSchema,
    storageNodeDescendantsSchema,
    storageNodeLookupSchema,
} from './storage-node.input.js';
import { storageNodeColumns, storageNodeContextSql } from './storage-node.sql.js';

@Injectable()
export class StorageNodeReader implements FacilityStorageTopologyReader {
    constructor(private readonly database: DatabaseRuntime) {}

    async findNode(input: StorageNodeLookup): Promise<StorageNodeFact | null> {
        const value = parseStorageNodeInput(storageNodeLookupSchema, input);
        const rows = await this.database.queryClient.$queryRaw<StorageNodeFact[]>(Prisma.sql`
            SELECT ${storageNodeColumns}
            FROM public."StorageNode" node
            WHERE ${storageNodeContextSql(value)}
              AND node.id = ${value.nodeId}::uuid
            LIMIT 1
        `);
        return rows[0] ? Object.freeze(rows[0]) : null;
    }

    listChildren(input: StorageNodeChildrenInput): Promise<StorageNodeCursorPage<StorageNodeFact>> {
        const value = parseStorageNodeInput(storageNodeChildrenSchema, input);
        const parent =
            value.parentId === null
                ? Prisma.sql`node."parentId" IS NULL`
                : Prisma.sql`
                node."parentId" = ${value.parentId}::uuid AND EXISTS (
                    SELECT 1 FROM public."StorageNode" parent
                    WHERE parent.id = ${value.parentId}::uuid
                      AND parent."organizationId" = ${value.organizationId}::uuid
                      AND parent."topologyId" = ${value.topologyId}::uuid
                      AND parent."archivedAt" IS NULL
                )
            `;
        return this.list(value, 'children', parent);
    }

    listDescendants(
        input: StorageNodeDescendantsInput
    ): Promise<StorageNodeCursorPage<StorageNodeFact>> {
        const value = parseStorageNodeInput(storageNodeDescendantsSchema, input);
        return this.list(
            value,
            'descendants',
            Prisma.sql`
            node.id <> ${value.rootNodeId}::uuid AND node.path <@ (
                SELECT root.path FROM public."StorageNode" root
                WHERE root.id = ${value.rootNodeId}::uuid
                  AND root."organizationId" = ${value.organizationId}::uuid
                  AND root."topologyId" = ${value.topologyId}::uuid
                  AND root."archivedAt" IS NULL
            )
        `
        );
    }

    async listAncestors(input: StorageNodeLookup): Promise<readonly StorageNodeFact[]> {
        const value = parseStorageNodeInput(storageNodeLookupSchema, input);
        const rows = await this.database.queryClient.$queryRaw<StorageNodeFact[]>(Prisma.sql`
            WITH target AS (
                SELECT node.id, node.path FROM public."StorageNode" node
                WHERE ${storageNodeContextSql(value)}
                  AND node.id = ${value.nodeId}::uuid
            )
            SELECT ${storageNodeColumns}
            FROM public."StorageNode" node, target
            WHERE ${storageNodeContextSql(value)}
              AND node.path @> target.path
              AND node.id <> target.id
            ORDER BY nlevel(node.path) ASC, node.id ASC
        `);
        return Object.freeze(rows.map((row) => Object.freeze(row)));
    }

    private async list(
        input: (StorageNodeChildrenInput | StorageNodeDescendantsInput) & { limit: number },
        order: StorageNodeCursorOrder,
        relation: Prisma.Sql
    ): Promise<StorageNodeCursorPage<StorageNodeFact>> {
        const queryKey = storageNodeQueryKey(input);
        const cursor = input.cursor
            ? decodeStorageNodeCursor(input.cursor, { queryKey, order })
            : undefined;
        const after = !cursor
            ? Prisma.sql`TRUE`
            : cursor.order === 'children'
              ? Prisma.sql`(node."sortOrder", node.id) > (${cursor.sortOrder}, ${cursor.id}::uuid)`
              : Prisma.sql`
                    (node.path, node.id) > (
                        (
                            SELECT cursor_node.path FROM public."StorageNode" cursor_node
                            WHERE cursor_node.id = ${cursor.id}::uuid
                              AND cursor_node."organizationId" = ${input.organizationId}::uuid
                              AND cursor_node."topologyId" = ${input.topologyId}::uuid
                        ),
                        ${cursor.id}::uuid
                    )
                `;
        const rows = await this.database.queryClient.$queryRaw<StorageNodeFact[]>(Prisma.sql`
            SELECT ${storageNodeColumns}
            FROM public."StorageNode" node
            WHERE ${storageNodeContextSql(input)}
              AND (${relation})
              AND (${after})
            ORDER BY ${
                order === 'children'
                    ? Prisma.sql`node."sortOrder" ASC, node.id ASC`
                    : Prisma.sql`node.path ASC, node.id ASC`
            }
            LIMIT ${input.limit + 1}
        `);
        const hasNextPage = rows.length > input.limit;
        const items = rows.slice(0, input.limit);
        const last = items.at(-1);
        const nextCursor =
            hasNextPage && last
                ? encodeStorageNodeCursor(
                      order === 'children'
                          ? { version: 1, queryKey, order, id: last.id, sortOrder: last.sortOrder }
                          : { version: 1, queryKey, order, id: last.id }
                  )
                : null;
        return Object.freeze({
            items: Object.freeze(items.map((row) => Object.freeze(row))),
            nextCursor,
            hasNextPage,
        });
    }
}
