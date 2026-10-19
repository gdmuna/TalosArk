import {
    MaterialSchema,
    MaterialPageSchema,
    MaterialOverviewSchema,
    MaterialDetailSchema,
    MaterialTypeListSchema,
    MaterialTypeSchema,
    BatchArchiveSchema,
    BatchQuerySchema,
    BatchUpdateSchema,
    BatchWriteSchema,
    BatchPageSchema,
    BatchSchema,
    type MaterialScope,
} from '@talos-ark/contracts/material';
import { HttpError, type HttpClient } from '@/platform/http';
import type { MaterialDataSource, MaterialBatch } from './source';
import { createHttpMaterialAttachmentDataSource } from './attachment-api';

function assertBatch(scope: MaterialScope, materialId: string, value: MaterialBatch, id?: string) {
    if (
        value.organizationId !== scope.organizationId ||
        value.workspaceId !== scope.workspaceId ||
        value.materialId !== materialId ||
        (id && value.id !== id)
    )
        throw new HttpError('批次响应范围或身份不匹配', 'protocol');
}

export function createHttpMaterialDataSource(http: HttpClient): MaterialDataSource {
    const root = (scope: { organizationId: string; workspaceId: string }) =>
        `/organization/${encodeURIComponent(scope.organizationId)}/workspace/${encodeURIComponent(scope.workspaceId)}/material`;
    return {
        attachments: createHttpMaterialAttachmentDataSource(http),
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
        async overview(scope, signal) {
            const result = await http.request({
                method: 'GET',
                path: root(scope) + '/overview',
                schema: MaterialOverviewSchema,
                signal,
                retry: false,
            });
            if (
                result.recent.some(
                    (item) =>
                        item.organizationId !== scope.organizationId ||
                        item.workspaceId !== scope.workspaceId
                )
            )
                throw new HttpError('材料概览响应范围不匹配', 'protocol');
            return result;
        },
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
        async listBatches(scope, materialId, query, signal) {
            const result = await http.request({
                method: 'GET',
                path: `${root(scope)}/${encodeURIComponent(materialId)}/batch`,
                params: BatchQuerySchema.parse(query),
                schema: BatchPageSchema,
                signal,
                retry: false,
            });
            if (
                result.page !== query.page ||
                result.pageSize !== query.pageSize ||
                result.items.length > query.pageSize ||
                result.total < result.items.length ||
                new Set(result.items.map((item) => item.id)).size !== result.items.length
            )
                throw new HttpError('批次响应分页不一致', 'protocol');
            result.items.forEach((item) => assertBatch(scope, materialId, item));
            return result;
        },
        async getBatch(scope, materialId, batchId, signal) {
            const result = await http.request({
                method: 'GET',
                path: `${root(scope)}/${encodeURIComponent(materialId)}/batch/${encodeURIComponent(batchId)}`,
                schema: BatchSchema,
                signal,
                retry: false,
            });
            assertBatch(scope, materialId, result, batchId);
            return result;
        },
        async createBatch(scope, materialId, body, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${root(scope)}/${encodeURIComponent(materialId)}/batch`,
                body: BatchWriteSchema.parse(body),
                schema: BatchSchema,
                signal,
                retry: false,
            });
            assertBatch(scope, materialId, result);
            return result;
        },
        async updateBatch(scope, materialId, batchId, body, signal) {
            const result = await http.request({
                method: 'PATCH',
                path: `${root(scope)}/${encodeURIComponent(materialId)}/batch/${encodeURIComponent(batchId)}`,
                body: BatchUpdateSchema.parse(body),
                schema: BatchSchema,
                signal,
                retry: false,
            });
            assertBatch(scope, materialId, result, batchId);
            return result;
        },
        async archiveBatch(scope, materialId, batchId, body, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${root(scope)}/${encodeURIComponent(materialId)}/batch/${encodeURIComponent(batchId)}/archive`,
                body: BatchArchiveSchema.parse(body),
                schema: BatchSchema,
                signal,
                retry: false,
            });
            assertBatch(scope, materialId, result, batchId);
            return result;
        },
    };
}
