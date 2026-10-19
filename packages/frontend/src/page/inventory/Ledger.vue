<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CalendarDays, Eye, MapPin, Package, Tag } from '@lucide/vue';
import type { PaginationState } from '@tanstack/vue-table';
import type { InventoryQuery, InventoryStock } from '@/module/inventory';
import { useInventoryDataSource, useInventoryRead, useInventoryReceiptStore } from '@/module/inventory';
import { inventoryStatusLabel, inventoryExpiryLabel, useInventoryScope } from '@/module/inventory';
import { DataTable, type DataTableAction, type DataTableColumn } from '@/component/data-table';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import InventoryReceiptDialog from './component/InventoryReceiptDialog.vue';
import { useResourceQuery } from '../resource/useResourceQuery';
import { useQueryCommand } from '@/platform/navigation';

const router = useRouter();
const route = useRoute();
const source = useInventoryDataSource();
const scope = useInventoryScope();
const receiptStore = useInventoryReceiptStore();
const recovering = computed(() => !!receiptStore.current(scope.value));
const query = useResourceQuery();
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const selectedId = ref('');
useQueryCommand('resource', (id) => {
    selectedId.value = id;
});
const materialId = computed(() => (typeof route.query.materialId === 'string' ? route.query.materialId : undefined));
const batchId = computed(() => (typeof route.query.batchId === 'string' ? route.query.batchId : undefined));
const request = computed<InventoryQuery>(() => ({
    page: pagination.value.pageIndex + 1,
    pageSize: pagination.value.pageSize,
    q: query.value.trim(),
    materialId: materialId.value,
    batchId: batchId.value,
}));
const key = computed(() => JSON.stringify(request.value));
const { data, loading, error, refresh } = useInventoryRead(key, (scope, signal) => {
    if (!source) return Promise.reject(new Error('库存数据源未连接'));
    return source.list(scope, request.value, signal);
});
const total = ref(0);
watch([data, error], ([value, failure]) => {
    if (value) total.value = value.total;
    else if (failure) total.value = 0;
});
const context = useInventoryRead(
    computed(() => (scope.value ? JSON.stringify(scope.value) : '')),
    (currentScope, signal) => {
        if (!source) return Promise.reject(new Error('库存数据源未连接'));
        return source.context(currentScope, signal);
    }
);
const preview = useInventoryRead(selectedId, (currentScope, signal) => {
    if (!source) return Promise.reject(new Error('库存数据源未连接'));
    return source.get(currentScope, selectedId.value, signal);
});
const selected = computed(() => preview.data.value);
watch(
    scope,
    () => {
        selectedId.value = '';
        total.value = 0;
        pagination.value.pageIndex = 0;
    },
    { flush: 'sync' }
);
watch(
    [query, materialId, batchId],
    () => {
        total.value = 0;
        pagination.value.pageIndex = 0;
    },
    { flush: 'sync' }
);
const receiptOpen = ref(false);
watch(receiptOpen, (value) => {
    if (value) void context.refresh();
});
const rows = computed(() => data.value?.items ?? []);
const columns: DataTableColumn<InventoryStock>[] = [
    { id: 'code', label: '库存实例', icon: Package, size: 260, fill: true, sortable: false, value: (row) => row.code },
    { id: 'material', label: '材料', icon: Tag, size: 220, sortable: false, value: (row) => row.material.name },
    { id: 'batch', label: '批次', size: 180, sortable: false, value: (row) => row.batch?.batchNumber ?? '—' },
    {
        id: 'quantity',
        label: '数量',
        size: 120,
        sortable: false,
        value: (row) => `${row.quantity} ${row.quantityUnit}`,
    },
    { id: 'status', label: '状态', size: 130, sortable: false, value: (row) => inventoryStatusLabel[row.status] },
    {
        id: 'expiryRisk',
        label: '有效期风险',
        size: 130,
        sortable: false,
        value: (row) => inventoryExpiryLabel[row.expiryRisk],
    },
    {
        id: 'location',
        label: '存储位置',
        icon: MapPin,
        size: 280,
        sortable: false,
        value: (row) => row.location?.path ?? (row.locationRestricted ? '位置受限' : '未分配'),
    },
    {
        id: 'createdAt',
        label: '入库时间',
        icon: CalendarDays,
        size: 190,
        sortable: false,
        value: (row) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }),
    },
];
const actions = computed<DataTableAction<InventoryStock>[]>(() => [
    {
        id: 'detail',
        label: '详情',
        icon: Eye,
        primary: true,
        run: (row) => void router.push(`/main/inventory/detail/${encodeURIComponent(row.id)}`),
    },
    {
        id: 'preview',
        label: '预览',
        icon: Eye,
        run: (row) => {
            selectedId.value = row.id;
        },
    },
]);
const open = computed({
    get: () => !!selectedId.value,
    set: (value) => {
        if (!value) selectedId.value = '';
    },
});
</script>

<template>
    <ResourcePage label="库存列表" layout="data">
        <template #actions>
            <Button
                :disabled="
                    !recovering && (!context.data.value?.capabilities.receive || !!context.error.value || loading)
                "
                @click="receiptOpen = true"
            >
                {{ recovering ? '核对上次入库' : '登记入库' }}
            </Button>
        </template>
        <div
            v-if="context.error.value"
            role="alert"
            class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
        >
            <p class="text-sm text-destructive">{{ context.error.value }}</p>
            <Button variant="outline" @click="context.refresh">重新加载</Button>
        </div>
        <div v-if="error" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <p class="text-sm text-destructive">{{ error }}</p>
            <Button variant="outline" @click="refresh">重新加载</Button>
        </div>
        <SheetInspector
            v-model:open="open"
            :title="selected?.material.name ?? '库存实例预览'"
            description="库存实例事实"
        >
            <template #main>
                <DataTable
                    v-model:query="query"
                    v-model:pagination="pagination"
                    :server-total="total"
                    :filtering="false"
                    :data="rows"
                    :columns="columns"
                    :actions="actions"
                    :busy="loading"
                    :empty-text="error ? '库存加载失败' : loading ? '正在加载库存' : '暂无库存实例'"
                    search-label="搜索库存实例、材料或编号"
                    :search-text="
                        (row) => `${row.code} ${row.material.name} ${row.material.code} ${row.batch?.batchNumber ?? ''}`
                    "
                    :preview="(row) => (selectedId = row.id)"
                >
                    <template #cell-code="{ row }">
                        <button
                            class="group flex w-full items-start gap-3 text-left after:absolute after:inset-0"
                            @click="selectedId = row.id"
                        >
                            <Package class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                            <span class="min-w-0">
                                <span class="block font-medium group-hover:underline group-focus-visible:underline">
                                    {{ row.code }}
                                </span>
                                <span class="mt-1 block text-xs text-muted-foreground">{{ row.id }}</span>
                            </span>
                        </button>
                    </template>
                    <template #cell-status="{ row }">
                        <StateBadge
                            :tone="
                                row.status === 'IN_STOCK'
                                    ? 'success'
                                    : row.status === 'QUARANTINED'
                                      ? 'warning'
                                      : 'neutral'
                            "
                        >
                            {{ inventoryStatusLabel[row.status] }}
                        </StateBadge>
                    </template>
                    <template #cell-expiryRisk="{ row }">
                        <StateBadge
                            :tone="
                                row.expiryRisk === 'EXPIRED'
                                    ? 'destructive'
                                    : row.expiryRisk === 'CURRENT'
                                      ? 'success'
                                      : 'neutral'
                            "
                        >
                            {{ inventoryExpiryLabel[row.expiryRisk] }}
                        </StateBadge>
                    </template>
                </DataTable>
            </template>
            <p v-if="preview.loading.value && !selected" class="p-6 text-sm text-muted-foreground">正在加载库存实例</p>
            <div v-if="preview.error.value" role="alert" class="space-y-2 p-6 text-sm">
                <p class="text-destructive">{{ preview.error.value }}</p>
                <Button variant="outline" @click="preview.refresh">重新加载</Button>
            </div>
            <template v-if="selected">
                <div class="space-y-6 p-6">
                    <div class="space-y-2">
                        <h2 class="text-lg font-semibold">{{ selected.material.name }}</h2>
                        <CopyableId :value="selected.id" label="库存实例 ID" />
                        <StateBadge :tone="selected.status === 'IN_STOCK' ? 'success' : 'neutral'">
                            {{ inventoryStatusLabel[selected.status] }}
                        </StateBadge>
                    </div>
                    <dl class="grid gap-4 text-sm">
                        <div>
                            <dt class="text-muted-foreground">数量</dt>
                            <dd>{{ selected.quantity }} {{ selected.quantityUnit }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">批次</dt>
                            <dd>{{ selected.batch?.batchNumber ?? '未关联' }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">位置</dt>
                            <dd>
                                {{ selected.location?.path ?? (selected.locationRestricted ? '位置受限' : '未分配') }}
                            </dd>
                        </div>
                    </dl>
                </div>
                <div class="border-t p-6">
                    <Button
                        class="w-full"
                        @click="router.push(`/main/inventory/detail/${encodeURIComponent(selected.id)}`)"
                    >
                        打开完整详情
                    </Button>
                </div>
            </template>
        </SheetInspector>
        <InventoryReceiptDialog
            v-model:open="receiptOpen"
            :scope="scope"
            :can-receive="
                !context.loading.value && !context.error.value && (context.data.value?.capabilities.receive ?? false)
            "
            :can-manage-batch="context.data.value?.capabilities.manageBatch ?? false"
            :business-date="context.data.value?.businessDate"
            :on-committed="async () => refresh()"
            @refresh-context="context.refresh"
        />
    </ResourcePage>
</template>
