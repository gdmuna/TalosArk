import {
    MaterialSchema,
    MaterialPageSchema,
    MaterialOverviewSchema,
    MaterialDetailSchema,
    MaterialTypeListSchema,
    MaterialTypeSchema,
} from '@talos-ark/contracts/material';
import type { HttpClient } from '@/platform/http';
import type { MaterialDataSource } from './source';

export function createHttpMaterialDataSource(http: HttpClient): MaterialDataSource {
    const root = (scope: { organizationId: string; workspaceId: string }) =>
        `/organization/${encodeURIComponent(scope.organizationId)}/workspace/${encodeURIComponent(scope.workspaceId)}/material`;
    return {
        list: (scope, query, signal) =>
            http.request({
                method: 'GET',
                path: root(scope),
                params: {
                    ...query,
                    branch: Array.isArray(query.branch) ? query.branch.join(',') : query.branch,
                    typeId: Array.isArray(query.typeId) ? query.typeId.join(',') : query.typeId,
                },
                schema: MaterialPageSchema,
                signal,
                retry: false,
            }),
        overview: (scope, signal) =>
            http.request({
                method: 'GET',
                path: root(scope) + '/overview',
                schema: MaterialOverviewSchema,
                signal,
                retry: false,
            }),
        get: (scope, id, signal) =>
            http.request({
                method: 'GET',
                path: `${root(scope)}/${encodeURIComponent(id)}`,
                schema: MaterialDetailSchema,
                signal,
                retry: false,
            }),
        types: (scope, signal) =>
            http.request({
                method: 'GET',
                path: root(scope) + '/type',
                schema: MaterialTypeListSchema,
                signal,
                retry: false,
            }),
        create: (scope, body, signal) =>
            http.request({
                method: 'POST',
                path: root(scope),
                body,
                schema: MaterialSchema,
                signal,
                retry: false,
            }),
        update: (scope, id, body, signal) =>
            http.request({
                method: 'PATCH',
                path: `${root(scope)}/${encodeURIComponent(id)}`,
                body,
                schema: MaterialSchema,
                signal,
                retry: false,
            }),
        archive: (scope, id, archived, signal) =>
            http.request({
                method: 'POST',
                path: `${root(scope)}/${encodeURIComponent(id)}/archive`,
                body: { archived },
                schema: MaterialSchema,
                signal,
                retry: false,
            }),
        createType: (scope, body, signal) =>
            http.request({
                method: 'POST',
                path: root(scope) + '/type',
                body,
                schema: MaterialTypeSchema,
                signal,
                retry: false,
            }),
        updateType: (scope, id, body, signal) =>
            http.request({
                method: 'PATCH',
                path: `${root(scope)}/type/${encodeURIComponent(id)}`,
                body,
                schema: MaterialTypeSchema,
                signal,
                retry: false,
            }),
        archiveType: (scope, id, archived, signal) =>
            http.request({
                method: 'POST',
                path: `${root(scope)}/type/${encodeURIComponent(id)}/archive`,
                body: { archived },
                schema: MaterialTypeSchema,
                signal,
                retry: false,
            }),
    };
}
