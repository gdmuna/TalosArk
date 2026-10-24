import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@root/prisma/generated/client.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { FacilityError } from '../../facility.error.js';
import {
    StorageNodeSchema,
    type StorageQuery,
    type FacilityCapabilities,
} from '@talos-ark/contracts/facility';

export interface StorageFact {
    id: string;
    resourceId: string;
    organizationId: string;
    topologyId: string;
    parentId: string | null;
    code: string | null;
    name: string;
    kind: 'CONTAINER' | 'POSITION';
    containerType:
        | 'FREEZER'
        | 'LIQUID_NITROGEN_TANK'
        | 'CABINET'
        | 'SHELF'
        | 'RACK'
        | 'DRAWER'
        | 'BOX'
        | 'PARTITION'
        | 'OTHER'
        | null;
    description: string | null;
    rowIndex: number | null;
    columnIndex: number | null;
    rowCount: number | null;
    columnCount: number | null;
    sortOrder: number;
    archivedAt: Date | null;
    disabledAt: Date | null;
    path: string;
    occupied: boolean;
    hasChildren: boolean;
    effectiveDisabled: boolean;
    effectiveArchived: boolean;
}
const cursorSchema = z.strictObject({ key: z.string(), order: z.number().int(), id: z.uuid() });
const columns = Prisma.sql`node.id, node."resourceId", node."organizationId", node."topologyId", node."parentId",
    node.code, node.name, node.kind, node."containerType", node.description, node."rowIndex", node."columnIndex",
    node."rowCount", node."columnCount", node."sortOrder", node."archivedAt", node."disabledAt", node.path::text,
    EXISTS(SELECT 1 FROM "Placement" placement WHERE placement."storageNodeId" = node.id) AS occupied,
    EXISTS(SELECT 1 FROM "StorageNode" child WHERE child."parentId" = node.id AND child."archivedAt" IS NULL) AS "hasChildren",
    EXISTS(SELECT 1 FROM "StorageNode" ancestor WHERE ancestor."topologyId" = node."topologyId" AND ancestor.path @> node.path AND ancestor."disabledAt" IS NOT NULL) AS "effectiveDisabled",
    EXISTS(SELECT 1 FROM "StorageNode" ancestor WHERE ancestor."topologyId" = node."topologyId" AND ancestor.path @> node.path AND ancestor."archivedAt" IS NOT NULL) AS "effectiveArchived"`;

@Injectable()
export class FacilityStorageReader {
    constructor(private readonly database: DatabaseRuntime) {}

    async one(organizationId: string, topologyId: string, nodeId: string) {
        const rows = await this.database.queryClient.$queryRaw<
            StorageFact[]
        >(Prisma.sql`SELECT ${columns} FROM "StorageNode" node
            WHERE node."organizationId" = ${organizationId}::uuid AND node."topologyId" = ${topologyId}::uuid AND node.id = ${nodeId}::uuid`);
        if (!rows[0]) throw new FacilityError({ reason: 'forbidden' });
        return rows[0];
    }
    async many(organizationId: string, nodeIds: readonly string[]) {
        if (!nodeIds.length) return [];
        return this.database.queryClient.$queryRaw<StorageFact[]>(Prisma.sql`
            SELECT ${columns} FROM "StorageNode" node
            WHERE node."organizationId" = ${organizationId}::uuid
            AND node.id IN (${Prisma.join(nodeIds.map((id) => Prisma.sql`${id}::uuid`))})`);
    }
    async ancestors(node: StorageFact) {
        return this.database.queryClient.$queryRaw<
            { id: string; code: string | null; name: string }[]
        >`
            SELECT id, code, name FROM "StorageNode" WHERE "organizationId" = ${node.organizationId}::uuid
            AND "topologyId" = ${node.topologyId}::uuid AND path @> ${node.path}::ltree AND id <> ${node.id}::uuid ORDER BY nlevel(path)`;
    }
    async occupied(node: StorageFact) {
        const rows = await this.database.queryClient.$queryRaw<{ occupied: boolean }[]>`
            SELECT EXISTS(SELECT 1 FROM "Placement" placement JOIN "StorageNode" child ON child.id = placement."storageNodeId"
                WHERE child."organizationId" = ${node.organizationId}::uuid AND child."topologyId" = ${node.topologyId}::uuid AND child.path <@ ${node.path}::ltree) AS occupied`;
        return rows[0].occupied;
    }
    view(
        node: StorageFact,
        facility: { id: string; disabledAt: Date | null; archivedAt: Date | null },
        capabilities: FacilityCapabilities
    ) {
        const {
            path: _path,
            effectiveDisabled,
            effectiveArchived,
            archivedAt,
            disabledAt,
            ...fields
        } = node;
        const unavailableReason =
            facility.archivedAt || effectiveArchived
                ? 'archived'
                : facility.disabledAt || effectiveDisabled
                  ? 'disabled'
                  : node.kind !== 'POSITION'
                    ? 'not-position'
                    : node.occupied
                      ? 'occupied'
                      : !capabilities.use
                        ? 'no-use-permission'
                        : null;
        return StorageNodeSchema.parse({
            ...fields,
            facilityId: facility.id,
            archivedAt: archivedAt?.toISOString() ?? null,
            disabledAt: disabledAt?.toISOString() ?? null,
            usable: unavailableReason === null,
            unavailableReason,
        });
    }
    async page(
        organizationId: string,
        topologyId: string,
        query: StorageQuery,
        revision: number,
        facilityUsable: boolean
    ) {
        const key = createHash('sha256')
            .update(
                JSON.stringify([
                    organizationId,
                    topologyId,
                    query.workspaceId,
                    query.parentId,
                    query.mode,
                    query.q,
                    query.state,
                    revision,
                ])
            )
            .digest('hex');
        let after = Prisma.sql`TRUE`;
        if (query.cursor) {
            try {
                const cursor = cursorSchema.parse(
                    JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'))
                );
                if (cursor.key !== key) throw new Error('cursor context changed');
                after = Prisma.sql`(node."sortOrder", node.id) > (${cursor.order}, ${cursor.id}::uuid)`;
            } catch {
                throw new FacilityError({ reason: 'invalid-cursor' });
            }
        }
        const relation =
            query.mode === 'children'
                ? query.parentId
                    ? Prisma.sql`node."parentId" = ${query.parentId}::uuid`
                    : Prisma.sql`node."parentId" IS NULL`
                : query.parentId
                  ? Prisma.sql`node.path <@ (SELECT path FROM "StorageNode" WHERE id = ${query.parentId}::uuid AND "topologyId" = ${topologyId}::uuid)`
                  : Prisma.sql`TRUE`;
        const state =
            query.state === 'all'
                ? Prisma.sql`TRUE`
                : query.state === 'archived'
                  ? Prisma.sql`node."archivedAt" IS NOT NULL`
                  : Prisma.sql`node."archivedAt" IS NULL`;
        const search = query.q
            ? Prisma.sql`(strpos(lower(node.name), lower(${query.q})) > 0 OR strpos(lower(node.code), lower(${query.q})) > 0)`
            : Prisma.sql`TRUE`;
        const usable =
            query.mode !== 'positions'
                ? Prisma.sql`TRUE`
                : Prisma.sql`${facilityUsable} AND node.kind = 'POSITION'
            AND NOT EXISTS(SELECT 1 FROM "Placement" placement WHERE placement."storageNodeId" = node.id)
            AND NOT EXISTS(SELECT 1 FROM "StorageNode" ancestor WHERE ancestor."topologyId" = node."topologyId" AND ancestor.path @> node.path AND (ancestor."archivedAt" IS NOT NULL OR ancestor."disabledAt" IS NOT NULL))`;
        const rows = await this.database.queryClient.$queryRaw<
            StorageFact[]
        >(Prisma.sql`SELECT ${columns} FROM "StorageNode" node
            WHERE node."organizationId" = ${organizationId}::uuid AND node."topologyId" = ${topologyId}::uuid
            AND (${relation}) AND (${state}) AND (${search}) AND (${usable}) AND (${after})
            ORDER BY node."sortOrder", node.id LIMIT ${query.limit + 1}`);
        const items = rows.slice(0, query.limit);
        const last = items.at(-1);
        const hasNextPage = rows.length > query.limit;
        return {
            items,
            hasNextPage,
            nextCursor:
                hasNextPage && last
                    ? Buffer.from(
                          JSON.stringify({ key, order: last.sortOrder, id: last.id })
                      ).toString('base64url')
                    : null,
        };
    }
}
