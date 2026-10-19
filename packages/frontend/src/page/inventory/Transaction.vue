<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { CalendarDays, Eye, ListRestart, Package } from '@lucide/vue';
import type { PaginationState } from '@tanstack/vue-table';
import type { InventoryQuery, InventoryTransaction } from '@/module/inventory';
import {
    InventoryTransactionInspector,
    inventoryTransactionLabel,
    useInventoryDataSource,
    useInventoryRead,
} from '@/module/inventory';
import { DataTable, type DataTableAction, type DataTableColumn } from '@/component/data-table';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import { useResourceQuery } from '../resource/useResourceQuery';

const source = useInventoryDataSource();
const route = useRoute();
const query = useResourceQuery();
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const selectedId = ref('');
const request = computed<InventoryQuery>(() => ({
    page: pagination.value.pageIndex + 1,
    pageSize: pagination.value.pageSize,
    q: query.value.trim(),
    stockItemId: typeof route.query.stockItemId === 'string' ? route.query.stockItemId : undefined,
    operationId: typeof route.query.operationId === 'string' ? route.query.operationId : undefined,
}));
const key = computed(() => JSON.stringify(request.value));
const { data, loading, error, refresh, scope } = useInventoryRead(key, (scope, signal) => {
    if (!source) return Promise.reject(new Error('库存数据源未连接'));
    return source.transactions(scope, request.value, signal);
});
const total = ref(0);
watch([data, error], ([value, failure]) => {
    if (value) total.value = value.total;
    else if (failure) total.value = 0;
});
const rows = computed(() => data.value?.items ?? []);
const columns: DataTableColumn<InventoryTransaction>[] = [
    {
        id: 'occurredAt',
        label: '时间',
        icon: CalendarDays,
        size: 190,
        sortable: false,
        value: (row) => new Date(row.occurredAt).toLocaleString('zh-CN', { hour12: false }),
    },
    {
        id: 'type',
        label: '流水类型',
        icon: ListRestart,
        size: 180,
        sortable: false,
        value: (row) => inventoryTransactionLabel(row.type),
    },
    { id: 'operationId', label: '操作 ID', size: 260, sortable: false, value: (row) => row.operationId },
    { id: 'lines', label: '明细数', icon: Package, size: 120, sortable: false, value: (row) => row.lines.length },
    { id: 'reason', label: '原因', size: 280, sortable: false, value: (row) => row.reason ?? '—' },
];
const actions: DataTableAction<InventoryTransaction>[] = [
    {
        id: 'preview',
        label: '预览',
        icon: Eye,
        run: (row) => {
            selectedId.value = row.id;
        },
    },
];
watch(
    [scope, query, () => route.query.stockItemId, () => route.query.operationId],
    () => {
        total.value = 0;
        pagination.value.pageIndex = 0;
    },
    { flush: 'sync' }
);
</script>

<template>
    <ResourcePage label="出入库流水" layout="table">
        <div v-if="error" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <p class="text-sm text-destructive">{{ error }}</p>
            <Button variant="outline" @click="refresh">重新加载</Button>
        </div>
        <DataTable
            v-model:query="query"
            v-model:pagination="pagination"
            :server-total="total"
            :data="rows"
            :columns="columns"
            :actions="actions"
            :filtering="false"
            :busy="loading"
            :empty-text="error ? '流水加载失败' : loading ? '正在加载流水' : '暂无库存流水'"
            search-label="搜索实例编号"
            :preview="
                (row) => {
                    selectedId = row.id;
                }
            "
        />
        <InventoryTransactionInspector v-model:id="selectedId" />
    </ResourcePage>
</template>
