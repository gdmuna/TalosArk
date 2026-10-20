import {
    InventoryContextSchema,
    InventoryActionSchema,
    InstanceCorrectionSchema,
    InventoryQuerySchema,
    OperationReceiptSchema,
    ReceiptSchema,
    RelocationSchema,
    RelocationExecuteSchema,
    RelocationPreviewSchema,
    StockPageSchema,
    StockSchema,
    TransactionPageSchema,
    TransactionSchema,
} from '@talos-ark/contracts/inventory';
import { z } from 'zod';
import { HttpError, type HttpClient } from '@/platform/http';
import type { InventoryDataSource, InventoryScope, InventoryStock, InventoryQuery } from './source';

const initializeSchema = z.object({ updated: z.boolean() });
const root = (scope: InventoryScope) =>
    `/organization/${encodeURIComponent(scope.organizationId)}/workspace/${encodeURIComponent(scope.workspaceId)}/inventory`;
const organizationRoot = (organizationId: string) =>
    `/organization/${encodeURIComponent(organizationId)}/inventory`;

function assertStock(scope: InventoryScope, value: InventoryStock, id?: string) {
    if (
        value.organizationId !== scope.organizationId ||
        value.workspaceId !== scope.workspaceId ||
        (id && value.id !== id) ||
        (value.batch &&
            (value.batch.organizationId !== scope.organizationId ||
                value.batch.workspaceId !== scope.workspaceId ||
                value.batch.materialId !== value.material.id))
    )
        throw new HttpError('库存响应范围或身份不匹配', 'protocol');
}
function assertPage(
    query: InventoryQuery,
    page: { page: number; pageSize: number; total: number; items: { id: string }[] }
) {
    if (
        page.page !== query.page ||
        page.pageSize !== query.pageSize ||
        page.items.length > query.pageSize ||
        page.total < page.items.length ||
        new Set(page.items.map((item) => item.id)).size !== page.items.length
    )
        throw new HttpError('库存响应分页不一致', 'protocol');
}

export function createHttpInventoryDataSource(http: HttpClient): InventoryDataSource {
    return {
        context: (scope, signal) =>
            http.request({
                method: 'GET',
                path: `${root(scope)}/context`,
                schema: InventoryContextSchema,
                signal,
                retry: false,
            }),
        async list(scope, query, signal) {
            const result = await http.request({
                method: 'GET',
                path: root(scope),
                params: InventoryQuerySchema.parse(query),
                schema: StockPageSchema,
                signal,
                retry: false,
            });
            assertPage(query, result);
            result.items.forEach((item) => assertStock(scope, item));
            return result;
        },
        async get(scope, id, signal) {
            const result = await http.request({
                method: 'GET',
                path: `${root(scope)}/${encodeURIComponent(id)}`,
                schema: StockSchema,
                signal,
                retry: false,
            });
            assertStock(scope, result, id);
            return result;
        },
        async receive(scope, body, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${root(scope)}/receipt`,
                body: ReceiptSchema.parse(body),
                schema: OperationReceiptSchema,
                signal,
                retry: false,
            });
            if (
                result.kind !== 'inventory.receive' ||
                !result.stockItemId ||
                !result.instanceId ||
                (result.nodeId !== null && result.nodeId !== body.position.nodeId)
            )
                throw new HttpError('入库回执身份不一致', 'protocol');
            return result;
        },
        async correct(scope, id, body, signal) {
            const result = await http.request({
                method: 'PATCH',
                path: `${root(scope)}/${encodeURIComponent(id)}/facts`,
                body: InstanceCorrectionSchema.parse(body),
                schema: StockSchema,
                signal,
                retry: false,
            });
            assertStock(scope, result, id);
            return result;
        },
        async act(scope, stockItemId, input, signal) {
            const command = InventoryActionSchema.parse(input);
            const result = await http.request({
                method: 'POST',
                path: `${root(scope)}/${encodeURIComponent(stockItemId)}/${command.kind}`,
                body: command.body,
                schema: OperationReceiptSchema,
                signal,
                retry: false,
            });
            if (
                result.kind !== `inventory.${command.kind}` ||
                result.stockItemId !== stockItemId ||
                (command.kind === 'transfer' &&
                    result.nodeId !== null &&
                    result.nodeId !== command.body.position.nodeId)
            )
                throw new HttpError('库存动作回执身份不一致', 'protocol');
            return result;
        },
        async transactions(scope, query, signal) {
            const result = await http.request({
                method: 'GET',
                path: `${root(scope)}/transaction`,
                params: InventoryQuerySchema.parse(query),
                schema: TransactionPageSchema,
                signal,
                retry: false,
            });
            assertPage(query, result);
            if (result.items.some((item) => item.workspaceId !== scope.workspaceId))
                throw new HttpError('流水响应工作区不匹配', 'protocol');
            return result;
        },
        async transaction(scope, id, signal) {
            const result = await http.request({
                method: 'GET',
                path: `${root(scope)}/transaction/${encodeURIComponent(id)}`,
                schema: TransactionSchema,
                signal,
                retry: false,
            });
            if (result.id !== id || result.workspaceId !== scope.workspaceId)
                throw new HttpError('流水响应范围或身份不匹配', 'protocol');
            return result;
        },
        initialize: (organizationId, signal) =>
            http.request({
                method: 'POST',
                path: `${organizationRoot(organizationId)}/initialize`,
                schema: initializeSchema,
                signal,
                retry: false,
            }),
        async previewRelocation(organizationId, input, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${organizationRoot(organizationId)}/container-relocation/preview`,
                body: RelocationSchema.parse(input),
                schema: RelocationPreviewSchema,
                signal,
                retry: false,
            });
            if (
                !/^[0-9a-f]{64}$/.test(result.fingerprint) ||
                result.nodeCount < 1 ||
                result.itemCount !== result.items.length ||
                new Set(result.items.map((item) => item.stockItemId)).size !==
                    result.items.length ||
                new Set(result.workspaceIds).size !== result.workspaceIds.length ||
                result.workspaceIds.length !==
                    new Set(result.items.map((item) => item.workspaceId)).size ||
                result.items.some((item) => !result.workspaceIds.includes(item.workspaceId))
            )
                throw new HttpError('搬迁影响预览不一致', 'protocol');
            return result;
        },
        async relocate(organizationId, input, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${organizationRoot(organizationId)}/container-relocation`,
                body: RelocationExecuteSchema.parse(input),
                schema: OperationReceiptSchema,
                signal,
                retry: false,
            });
            if (
                result.kind !== 'inventory.relocate' ||
                (result.nodeId !== null && result.nodeId !== input.nodeId)
            )
                throw new HttpError('搬迁回执身份不一致', 'protocol');
            return result;
        },
        async operation(organizationId, id, signal) {
            const result = await http.request({
                method: 'GET',
                path: `${organizationRoot(organizationId)}/operation/${encodeURIComponent(id)}`,
                schema: OperationReceiptSchema,
                signal,
                retry: false,
            });
            if (result.operationId !== id) throw new HttpError('操作回执身份不一致', 'protocol');
            return result;
        },
    };
}
