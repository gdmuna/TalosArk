<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { refDebounced } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { Archive, ArchiveRestore, CalendarDays, Eye, MapPin, Package, Pencil, Tag } from '@lucide/vue';
import type { PaginationState } from '@tanstack/vue-table';
import { MaterialBatchEditor, useMaterialBatchRecovery, useMaterialRead, useMaterialStore } from '@/module/material';
import {
    InventoryStockInspector,
    inventoryStatusLabel,
    inventoryStatusTone,
    useInventoryDataSource,
    useInventoryRead,
    useInventoryScope,
    type InventoryQuery,
    type InventoryStock,
} from '@/module/inventory';
import { DataTable, type DataTableAction, type DataTableColumn } from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { Button } from '@/ui/button';
import { CopyableId } from '@/component/inspector';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceFactList from '../../resource/ResourceFactList.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';

const route = useRoute();
const router = useRouter();
const store = useMaterialStore();
const inventorySource = useInventoryDataSource();
const inventoryScope = useInventoryScope();
const materialId = computed(() => String(route.params.resourceId ?? ''));
const batchId = computed(() => String(route.params.batchId ?? ''));
const materialPath = computed(() => `/main/material/detail/${encodeURIComponent(materialId.value)}`);
const material = useMaterialRead(
    (context, signal) => context.source.get(context.scope, materialId.value, signal),
    [materialId]
);
const { data, loading, error, reload } = useMaterialRead(
    (context, signal) => context.source.getBatch(context.scope, materialId.value, batchId.value, signal),
    [materialId, batchId]
);
const permissions = useMaterialRead(
    (context, signal) =>
        context.source.listBatches(
            context.scope,
            materialId.value,
            { q: '', state: 'all', page: 1, pageSize: 1 },
            signal
        ),
    [materialId]
);
const inventoryQuery = ref('');
const inventorySearch = refDebounced(inventoryQuery, 200);
const inventoryPagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const inventoryPreviewId = ref('');
const inventoryRequest = computed<InventoryQuery>(() => ({
    page: inventoryPagination.value.pageIndex + 1,
    pageSize: inventoryPagination.value.pageSize,
    q: inventorySearch.value.trim(),
    materialId: materialId.value,
    batchId: batchId.value,
}));
const inventoryKey = computed(() =>
    inventoryScope.value ? JSON.stringify([inventoryScope.value, inventoryRequest.value]) : ''
);
const inventory = useInventoryRead(inventoryKey, (scope, signal) =>
    inventorySource
        ? inventorySource.list(scope, inventoryRequest.value, signal)
        : Promise.reject(new Error('库存数据源未连接'))
);
const inventoryTotal = ref(0);
watch([inventory.data, inventory.loading], ([value, loading]) => {
    if (value) inventoryTotal.value = value.total;
    else if (!loading) inventoryTotal.value = 0;
});
watch(
    [() => store.scope, materialId, batchId],
    () => {
        inventoryPreviewId.value = '';
        inventoryTotal.value = 0;
        inventoryPagination.value.pageIndex = 0;
    },
    { flush: 'sync' }
);
watch(
    inventorySearch,
    () => {
        inventoryPagination.value.pageIndex = 0;
        inventoryPreviewId.value = '';
        inventoryTotal.value = 0;
    },
    { flush: 'sync' }
);
const inventoryColumns: DataTableColumn<InventoryStock>[] = [
    { id: 'code', label: '实例编号', icon: Package, size: 190, fill: true, sortable: false, value: (row) => row.code },
    { id: 'material', label: '材料', icon: Tag, size: 220, sortable: false, value: (row) => row.material.name },
    {
        id: 'quantity',
        label: '数量',
        size: 130,
        align: 'right',
        sortable: false,
        value: (row) => `${row.quantity} ${row.quantityUnit}`,
    },
    { id: 'status', label: '状态', size: 120, sortable: false, value: (row) => inventoryStatusLabel[row.status] },
    {
        id: 'location',
        label: '存储位置',
        icon: MapPin,
        size: 260,
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
const inventoryActions: DataTableAction<InventoryStock>[] = [
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
            inventoryPreviewId.value = row.id;
        },
    },
];
const editorOpen = ref(false);
const {
    syncPending,
    synchronize,
    afterCommit,
    archive: archiveBatch,
} = useMaterialBatchRecovery(
    () => materialId.value,
    reload,
    () => batchId.value
);
const disabled = computed(
    () =>
        !data.value ||
        !!error.value ||
        !!permissions.error.value ||
        !permissions.data.value?.canManage ||
        store.busy ||
        loading.value ||
        syncPending.value
);
watch(
    [() => store.scope, materialId, batchId],
    () => {
        editorOpen.value = false;
    },
    { flush: 'sync' }
);
provideBreadcrumbs(() => [
    { id: 'material-list', label: '材料列表', to: '/main/material/list' },
    {
        id: 'material',
        label: material.data.value?.material.name ?? '材料详情',
        to: { path: materialPath.value, query: { view: 'batch' } },
    },
    { id: 'batch', label: data.value?.batchNumber ?? '批次详情' },
]);
function archive() {
    const batch = data.value;
    if (!batch || disabled.value) return;
    return archiveBatch(batch, !batch.archivedAt);
}
</script>

<template>
    <ResourceDetailPage label="批次详情">
        <template #header>
            <ResourceObjectHeader
                :id="batchId"
                :title="data?.batchNumber ?? '批次详情'"
                :icon="Package"
                :status="data ? (data.archivedAt ? '已归档' : '有效') : undefined"
                :back-to="`${materialPath}?view=batch`"
                back-label="来源批次"
            >
                <Button variant="outline" :disabled="disabled || !!data?.archivedAt" @click="editorOpen = true">
                    <Pencil aria-hidden="true" />
                    编辑批次
                </Button>
                <Button variant="outline" :disabled="disabled" @click="archive">
                    <component :is="data?.archivedAt ? ArchiveRestore : Archive" aria-hidden="true" />
                    {{ data?.archivedAt ? '恢复批次' : '归档批次' }}
                </Button>
            </ResourceObjectHeader>
        </template>
        <div
            v-if="error || material.error.value || permissions.error.value || syncPending || store.error"
            role="alert"
            class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
        >
            <p class="text-sm text-destructive">
                {{
                    syncPending
                        ? '操作已成功，但批次尚未同步。请仅重新加载。'
                        : error || material.error.value || permissions.error.value || store.error
                }}
            </p>
            <Button
                variant="outline"
                :disabled="loading"
                @click="
                    synchronize();
                    material.reload();
                    permissions.reload();
                "
            >
                重新加载
            </Button>
        </div>
        <ResourceEmpty v-if="loading && !data" text="正在加载批次" />
        <ResourceEmpty v-else-if="!data" text="当前工作区没有可访问的批次" />
        <template v-else>
            <ResourceSection title="批次信息">
                <div class="space-y-4">
                    <CopyableId :value="data.id" label="批次 ID" />
                    <ResourceFactList
                        :fields="[
                            { label: '所属材料', value: material.data.value?.material.name ?? '正在加载' },
                            { label: '批号', value: data.batchNumber },
                            { label: '生产日期', value: data.manufacturedOn ?? '未填写' },
                            {
                                label: '有效期',
                                value:
                                    data.expiry.kind === 'DATED'
                                        ? data.expiry.date
                                        : data.expiry.kind === 'NONE'
                                          ? '无期限'
                                          : '未知',
                            },
                            { label: '状态', value: data.archivedAt ? '已归档' : '有效' },
                            { label: '备注', value: data.notes || '无' },
                        ]"
                    />
                </div>
            </ResourceSection>
            <ResourceSection title="批次库存实例">
                <div class="mb-3 flex justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        @click="router.push({ path: '/main/inventory/ledger', query: { materialId, batchId } })"
                    >
                        在库存台账中查看
                    </Button>
                </div>
                <div
                    v-if="inventory.error.value"
                    role="alert"
                    class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
                >
                    <p class="text-sm text-destructive">
                        {{
                            inventory.data.value ? '库存刷新失败，当前显示上次成功读取的数据。' : inventory.error.value
                        }}
                    </p>
                    <Button variant="outline" @click="inventory.refresh">重新加载</Button>
                </div>
                <DataTable
                    v-model:query="inventoryQuery"
                    v-model:pagination="inventoryPagination"
                    :data="inventory.data.value?.items ?? []"
                    :server-total="inventoryTotal"
                    :columns="inventoryColumns"
                    :actions="inventoryActions"
                    :filtering="false"
                    :busy="inventory.loading.value"
                    :preview="(row) => (inventoryPreviewId = row.id)"
                    :active-id="inventoryPreviewId"
                    search-label="搜索库存实例"
                    :empty-text="
                        inventory.error.value
                            ? '批次库存加载失败'
                            : inventory.loading.value
                              ? '正在读取批次库存'
                              : '当前批次暂无库存实例'
                    "
                >
                    <template #cell-status="{ row }">
                        <StateBadge :tone="inventoryStatusTone[row.status]">
                            {{ inventoryStatusLabel[row.status] }}
                        </StateBadge>
                    </template>
                    <template #cell-quantity="{ value }">
                        <span class="whitespace-nowrap tabular-nums">{{ value }}</span>
                    </template>
                    <template #cell-location="{ value }">
                        <span class="block truncate" :title="String(value)">{{ value }}</span>
                    </template>
                </DataTable>
            </ResourceSection>
        </template>
        <MaterialBatchEditor
            v-model:open="editorOpen"
            :material-id="materialId"
            :batch="data"
            :on-committed="afterCommit"
        />
        <InventoryStockInspector v-model:id="inventoryPreviewId" />
    </ResourceDetailPage>
</template>
