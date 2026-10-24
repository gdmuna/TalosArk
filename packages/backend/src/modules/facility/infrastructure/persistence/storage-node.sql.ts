import { Prisma } from '@root/prisma/generated/client.js';
import type { StorageNodeScope } from '../../public/facility-storage-topology.contract.js';

export const storageNodeColumns = Prisma.sql`
    node.id, node."organizationId", node."topologyId", node."resourceId",
    node."parentId", node.path::text AS path, node.code, node.name, node.kind,
    node."rowIndex", node."columnIndex", node."sortOrder", node."archivedAt"
`;

export function storageNodeScopeSql(scope: StorageNodeScope): Prisma.Sql {
    if (scope.kind === 'none') return Prisma.sql`FALSE`;
    const topology = Prisma.sql`
        node."organizationId" = ${scope.organizationId}::uuid
        AND node."topologyId" = ${scope.topologyId}::uuid
    `;
    if (scope.kind === 'topology') return topology;
    if (!scope.rootNodeIds.length) return Prisma.sql`FALSE`;
    return Prisma.sql`
        (${topology}) AND EXISTS (
            SELECT 1 FROM public."StorageNode" grant_root
            WHERE grant_root."organizationId" = node."organizationId"
              AND grant_root."topologyId" = node."topologyId"
              AND grant_root.id IN (${Prisma.join(scope.rootNodeIds.map((id) => Prisma.sql`${id}::uuid`))})
              AND grant_root."archivedAt" IS NULL
              AND node.path <@ grant_root.path
        )
    `;
}

export function storageNodeContextSql(input: {
    organizationId: string;
    topologyId: string;
    scope: StorageNodeScope;
}): Prisma.Sql {
    return Prisma.sql`
        node."organizationId" = ${input.organizationId}::uuid
        AND node."topologyId" = ${input.topologyId}::uuid
        AND node."archivedAt" IS NULL
        AND (${storageNodeScopeSql(input.scope)})
        AND EXISTS (
            SELECT 1 FROM public."StorageTopology" topology
            JOIN public."Facility" facility
              ON facility.id = topology."facilityId"
             AND facility."organizationId" = topology."organizationId"
            WHERE topology.id = node."topologyId"
              AND topology."organizationId" = node."organizationId"
              AND topology."archivedAt" IS NULL
              AND facility."archivedAt" IS NULL
        )
    `;
}
