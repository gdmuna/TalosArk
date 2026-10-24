import {
    FacilityDetailSchema,
    FacilityGovernanceSchema,
    FacilityInitializeSchema,
    FacilityPageSchema,
    FacilitySchema,
    StorageMutationSchema,
    StorageMoveResultSchema,
    StorageNodeDetailSchema,
    StorageNodePageSchema,
} from '@talos-ark/contracts/facility';
import { HttpError, type HttpClient } from '@/platform/http';
import type { FacilityDataSource, FacilityScope, StorageScope, StorageNodeDetail } from './source';
import {
    assertFacilityDetail,
    assertFacilityPage,
    assertFacilityScope,
    assertStorageNode,
} from './validation';
import type { z } from 'zod';

const root = (scope: FacilityScope) =>
    `/organization/${encodeURIComponent(scope.organizationId)}/facility`;
const facilityRoot = (scope: FacilityScope, id: string) =>
    `${root(scope)}/${encodeURIComponent(id)}`;
const nodeRoot = (scope: StorageScope) =>
    `${facilityRoot(scope, scope.facilityId)}/topology/${encodeURIComponent(scope.topologyId)}/node`;

function flattenNode(
    scope: StorageScope,
    value: z.infer<typeof StorageNodeDetailSchema>
): StorageNodeDetail {
    assertStorageNode(scope, value.node);
    if (
        new Set(value.ancestors.map((item) => item.id)).size !== value.ancestors.length ||
        value.ancestors.some((item) => item.id === value.node.id) ||
        (value.ancestors.at(-1)?.id ?? null) !== value.node.parentId
    )
        throw new HttpError('节点路径不一致', 'protocol');
    return {
        ...value.node,
        revision: value.revision,
        ancestors: value.ancestors,
        capabilities: value.capabilities,
    };
}

export function createHttpFacilityDataSource(http: HttpClient): FacilityDataSource {
    return {
        governance: (scope, signal) =>
            http.request({
                method: 'GET',
                path: `${root(scope)}/context`,
                schema: FacilityGovernanceSchema,
                signal,
                retry: false,
            }),
        initialize: (scope, signal) =>
            http.request({
                method: 'POST',
                path: `${root(scope)}/initialize`,
                schema: FacilityInitializeSchema,
                signal,
                retry: false,
            }),
        async list(scope, query, signal) {
            const result = await http.request({
                method: 'GET',
                path: root(scope),
                params: { ...query, state: query.state ?? 'all', workspaceId: scope.workspaceId },
                schema: FacilityPageSchema,
                signal,
                retry: false,
            });
            assertFacilityPage(scope, query, result);
            return result;
        },
        async detail(scope, id, signal) {
            const result = await http.request({
                method: 'GET',
                path: facilityRoot(scope, id),
                params: { workspaceId: scope.workspaceId },
                schema: FacilityDetailSchema,
                signal,
                retry: false,
            });
            assertFacilityDetail(scope, id, result);
            return result;
        },
        async create(scope, body, signal) {
            const result = await http.request({
                method: 'POST',
                path: root(scope),
                body,
                schema: FacilitySchema,
                signal,
                retry: false,
            });
            assertFacilityScope(scope, result);
            return result;
        },
        async update(scope, id, body, signal) {
            const result = await http.request({
                method: 'PATCH',
                path: facilityRoot(scope, id),
                body,
                schema: FacilitySchema,
                signal,
                retry: false,
            });
            assertFacilityScope(scope, result);
            if (result.id !== id) throw new HttpError('设施身份不一致', 'protocol');
            return result;
        },
        async state(scope, id, body, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${facilityRoot(scope, id)}/state`,
                body,
                schema: FacilitySchema,
                signal,
                retry: false,
            });
            assertFacilityScope(scope, result);
            if (result.id !== id) throw new HttpError('设施身份不一致', 'protocol');
            return result;
        },
        access: (scope, id, body, signal) =>
            http.request({
                method: 'POST',
                path: `${facilityRoot(scope, id)}/access`,
                body,
                schema: StorageMutationSchema,
                signal,
                retry: false,
            }),
        async children(scope, query, signal) {
            const result = await http.request({
                method: 'GET',
                path: nodeRoot(scope),
                params: {
                    ...query,
                    parentId: query.parentId ?? undefined,
                    workspaceId: scope.workspaceId,
                },
                schema: StorageNodePageSchema,
                signal,
                retry: false,
            });
            result.items.forEach((item) => assertStorageNode(scope, item));
            if (
                result.hasNextPage !== !!result.nextCursor ||
                result.items.length > query.limit ||
                new Set(result.items.map((item) => item.id)).size !== result.items.length ||
                ((!query.mode || query.mode === 'children') &&
                    result.items.some((item) => item.parentId !== query.parentId)) ||
                (query.mode === 'positions' &&
                    result.items.some((item) => item.kind !== 'POSITION' || !item.usable))
            )
                throw new HttpError('节点分页响应不一致', 'protocol');
            return { ...result, ...scope, parentId: query.parentId };
        },
        async node(scope, id, signal) {
            const result = await http.request({
                method: 'GET',
                path: `${nodeRoot(scope)}/${encodeURIComponent(id)}`,
                params: { workspaceId: scope.workspaceId },
                schema: StorageNodeDetailSchema,
                signal,
                retry: false,
            });
            if (result.node.id !== id) throw new HttpError('节点身份不一致', 'protocol');
            return flattenNode(scope, result);
        },
        async createNode(scope, body, signal) {
            return flattenNode(
                scope,
                await http.request({
                    method: 'POST',
                    path: nodeRoot(scope),
                    body: { ...body, workspaceId: scope.workspaceId },
                    schema: StorageNodeDetailSchema,
                    signal,
                    retry: false,
                })
            );
        },
        async updateNode(scope, id, body, signal) {
            const result = await http.request({
                method: 'PATCH',
                path: `${nodeRoot(scope)}/${encodeURIComponent(id)}`,
                body: { ...body, workspaceId: scope.workspaceId },
                schema: StorageNodeDetailSchema,
                signal,
                retry: false,
            });
            if (result.node.id !== id) throw new HttpError('节点身份不一致', 'protocol');
            return flattenNode(scope, result);
        },
        stateNode: (scope, id, body, signal) =>
            http.request({
                method: 'POST',
                path: `${nodeRoot(scope)}/${encodeURIComponent(id)}/state`,
                body: { ...body, workspaceId: scope.workspaceId },
                schema: StorageMutationSchema,
                signal,
                retry: false,
            }),
        moveNode: (scope, id, body, signal) =>
            http.request({
                method: 'POST',
                path: `${nodeRoot(scope)}/${encodeURIComponent(id)}/move`,
                body: { ...body, workspaceId: scope.workspaceId },
                schema: StorageMoveResultSchema,
                signal,
                retry: false,
            }),
        reorderNode: (scope, id, body, signal) =>
            http.request({
                method: 'POST',
                path: `${nodeRoot(scope)}/${encodeURIComponent(id)}/reorder`,
                body: { ...body, workspaceId: scope.workspaceId },
                schema: StorageMutationSchema,
                signal,
                retry: false,
            }),
        generateGrid: (scope, id, body, signal) =>
            http.request({
                method: 'POST',
                path: `${nodeRoot(scope)}/${encodeURIComponent(id)}/grid`,
                body: { ...body, workspaceId: scope.workspaceId },
                schema: StorageMutationSchema,
                signal,
                retry: false,
            }),
    };
}
