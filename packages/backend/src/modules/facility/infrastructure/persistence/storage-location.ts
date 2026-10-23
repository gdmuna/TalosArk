import { Prisma } from '@root/prisma/generated/client.js';
import type { DatabaseRuntime } from '@/infra/database/database.runtime.js';
export interface StorageLocation {
    facilityId: string;
    topologyId: string;
    nodeId: string;
    path: string;
}
/** Caller must authorize the complete node set before projecting names. */
export async function storageLocations(
    database: DatabaseRuntime,
    organizationId: string,
    nodeIds: readonly string[]
) {
    if (!nodeIds.length) return new Map<string, StorageLocation>();
    const rows = await database.queryClient.$queryRaw<StorageLocation[]>(Prisma.sql`
        SELECT node.id AS "nodeId", topology.id AS "topologyId", facility.id AS "facilityId",
        facility.name || ' / ' || string_agg(ancestor.name || CASE WHEN ancestor.code IS NULL THEN '' ELSE ' [' || ancestor.code || ']' END, ' / ' ORDER BY nlevel(ancestor.path)) AS path
        FROM "StorageNode" node JOIN "StorageTopology" topology ON topology.id = node."topologyId"
        JOIN "Facility" facility ON facility.id = topology."facilityId"
        JOIN "StorageNode" ancestor ON ancestor."topologyId" = node."topologyId" AND ancestor.path @> node.path
        WHERE node."organizationId" = ${organizationId}::uuid AND node.id IN (${Prisma.join(nodeIds.map((id) => Prisma.sql`${id}::uuid`))})
        GROUP BY node.id, topology.id, facility.id`);
    return new Map(rows.map((row) => [row.nodeId, row]));
}
