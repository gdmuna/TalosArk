<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isResponseValidationError } from '@/platform/http';
import { refDebounced } from '@vueuse/core';
import { Boxes, Clock, Eye, Plus, Search, ArrowRight } from '@lucide/vue';
import type { Material } from '@talos-ark/contracts/material';
import type { PaginationState } from '@tanstack/vue-table';
import { useMaterialRead, type MaterialBatchQuery } from '@/module/material';
import {
    useInventoryDataSource,
    useInventoryRead,
    useInventoryScope,
    useInventoryReceiptStore,
    InventoryStockInspector,
    inventoryStatusLabel,
    inventoryStatusTone,
    type InventoryQuery,
    type InventoryStock,
} from '@/module/inventory';
import { DataTable, type DataTableColumn, type DataTableAction } from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { SelectField } from '@/component/select-field';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import InventoryReceiptDialog from '../../inventory/component/InventoryReceiptDialog.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
const standaloneFieldId = useId();

import { Field, FieldLabel } from '@/ui/field';

const props = defineProps<{ material: Material; onCommitted: () => Promise<boolean>; syncFailure?: unknown }>();
const route = useRoute(),
    router = useRouter();
const id = computed(() => props.material.id);
const inventorySource = useInventoryDataSource();
const inventoryScope = useInventoryScope();
const receiptStore = useInventoryReceiptStore();
const receiptOpen = ref(false);
const recoveringReceipt = computed(() => !!receiptStore.current(inventoryScope.value));
const inventoryContext = useInventoryRead(id, (scope, signal) =>
    inventorySource ? inventorySource.context(scope, signal) : Promise.reject(new Error('库存数据源未连接'))
);
watch(receiptOpen, (open) => {
    if (open) void inventoryContext.refresh();
});
const batchId = computed({
    get: () => (typeof route.query.batchId === 'string' ? route.query.batchId : ''),
    set: (value: string) => {
        void router.replace({ query: { ...route.query, batchId: value || undefined }, hash: route.hash });
    },
});
const batchSearch = ref('');
const batchQuery = ref('');
const batchPage = ref(1);
const batchRequest = computed<MaterialBatchQuery>(() => ({
    q: batchQuery.value,
    state: 'all',
    page: batchPage.value,
    pageSize: 20,
}));
const batches = useMaterialRead(
    (context, signal) => context.source.listBatches(context.scope, id.value, batchRequest.value, signal),
    [id, batchRequest]
);
const selectedBatch = useMaterialRead(
    (context, signal) =>
        batchId.value
            ? context.source.getBatch(context.scope, id.value, batchId.value, signal)
            : Promise.resolve(undefined),
    [id, batchId]
);
const batchOptions = computed(() => {
    const items =
        batches.data.value?.items.map((batch) => ({
            value: batch.id,
            label: batch.batchNumber + (batch.archivedAt ? '（已归档）' : ''),
        })) ?? [];
    if (batchId.value && !items.some((item) => item.value === batchId.value)) {
        items.unshift({
            value: batchId.value,
            label: selectedBatch.data.value
                ? selectedBatch.data.value.batchNumber + (selectedBatch.data.value.archivedAt ? '（已归档）' : '')
                : selectedBatch.error.value
                  ? '批次不可用'
                  : '正在加载批次',
        });
    }
    return [{ value: 'all', label: '全部批次' }, ...items];
});
function searchBatches() {
    batchPage.value = 1;
    batchQuery.value = batchSearch.value.trim();
}
const inventoryPagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const inventoryQuery = ref('');
const inventorySearch = refDebounced(inventoryQuery, 200);
const inventoryRequest = computed<InventoryQuery>(() => ({
    page: inventoryPagination.value.pageIndex + 1,
    pageSize: inventoryPagination.value.pageSize,
    q: inventorySearch.value.trim(),
    materialId: id.value,
    batchId: batchId.value || undefined,
}));
const inventoryKey = computed(() =>
    inventoryScope.value && id.value ? JSON.stringify([inventoryScope.value, inventoryRequest.value]) : ''
);
const inventory = useInventoryRead(inventoryKey, (scope, signal) =>
    inventorySource
        ? inventorySource.list(scope, inventoryRequest.value, signal)
        : Promise.reject(new Error('库存数据源未连接'))
);
const inventoryData = computed(() => inventory.data.value);
const syncFailure = ref<unknown>();
const inventoryRows = computed(() => inventoryData.value?.items ?? []);
const inventoryLoading = computed(() => inventory.loading.value);
const inventoryError = computed(() => inventory.error.value);
const inventoryPreviewId = ref('');
const inventoryTotal = ref(0);
watch([inventory.data, inventory.error], ([value, failure]) => {
    if (value) inventoryTotal.value = value.total;
    else if (failure) inventoryTotal.value = 0;
});
watch([id, inventoryScope], () => {
    inventoryPreviewId.value = '';
    inventoryQuery.value = '';
    inventoryTotal.value = 0;
    inventoryPagination.value.pageIndex = 0;
    batchSearch.value = batchQuery.value = '';
    batchPage.value = 1;
    receiptOpen.value = false;
});
watch(
    [inventorySearch, batchId],
    () => {
        inventoryPagination.value.pageIndex = 0;
        inventoryPreviewId.value = '';
        inventoryTotal.value = 0;
    },
    { flush: 'sync' }
);
async function afterReceipt() {
    const results = await Promise.all([
        inventory.refresh(),
        props.onCommitted(),
        batches.reload(),
        selectedBatch.reload(),
    ]);
    const failures = [
        inventory.failure.value,
        props.syncFailure,
        batches.failure.value,
        selectedBatch.failure.value,
    ].filter((_, index) => !results[index]);
    syncFailure.value = failures.every(isResponseValidationError)
        ? failures[0]
        : failures.find((cause) => !isResponseValidationError(cause));
    return results.every(Boolean);
}
const inventoryColumns: DataTableColumn<InventoryStock>[] = [
    { id: 'code', label: '实例编号', icon: Boxes, size: 190, fill: true, sortable: false, value: (row) => row.code },
    { id: 'batch', label: '来源批次', size: 180, sortable: false, value: (row) => row.batch?.batchNumber ?? '未关联' },
    {
        id: 'quantity',
        label: '数量',
        size: 130,
        align: 'right',
        sortable: false,
        value: (row) => `${row.quantity} ${row.quantityUnit}`,
    },
    { id: 'status', label: '状态', size: 100, sortable: false, value: (row) => inventoryStatusLabel[row.status] },
    {
        id: 'location',
        label: '位置',
        size: 280,
        sortable: false,
        value: (row) => row.location?.path ?? (row.locationRestricted ? '位置受限' : '未分配'),
    },
    {
        id: 'createdAt',
        label: '入库时间',
        icon: Clock,
        size: 180,
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
        run: (row) => void router.push(`/main/inventory/detail/${row.id}`),
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
</script>
<template>
    <ResourceSection title="实例与库存">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm">已登记 {{ material.instanceCount }} 个实体实例。</p>
            <div class="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    @click="
                        router.push({
                            path: '/main/inventory/ledger',
                            query: { materialId: material.id, batchId: batchId || undefined },
                        })
                    "
                >
                    查看库存列表
                </Button>
                <Button
                    :disabled="
                        !recoveringReceipt &&
                        (!inventoryContext.data.value?.capabilities.receive ||
                            !!inventoryContext.error.value ||
                            inventoryContext.loading.value ||
                            !!material.archivedAt ||
                            !!selectedBatch.data.value?.archivedAt ||
                            !!selectedBatch.error.value ||
                            selectedBatch.loading.value)
                    "
                    @click="receiptOpen = true"
                >
                    <Plus aria-hidden="true" />
                    {{ recoveringReceipt ? '核对上次入库' : '登记入库' }}
                </Button>
            </div>
        </div>
        <div class="flex flex-wrap items-end gap-3 border-b py-4">
            <Field class="w-64 max-w-full">
                <FieldLabel :for="standaloneFieldId + '-1'">来源批次</FieldLabel>
                <SelectField
                    :id="standaloneFieldId + '-1'"
                    :model-value="batchId || 'all'"
                    label="来源批次"
                    :options="batchOptions"
                    :disabled="batches.loading.value"
                    @update:model-value="batchId = $event === 'all' ? '' : $event"
                />
            </Field>
            <form class="flex min-w-0 gap-2" @submit.prevent="searchBatches">
                <Field class="w-48">
                    <FieldLabel :for="standaloneFieldId + '-search'" class="sr-only">搜索可选批次</FieldLabel>
                    <Input
                        :id="standaloneFieldId + '-search'"
                        v-model="batchSearch"
                        aria-label="搜索可选批次"
                        placeholder="搜索批号"
                        maxlength="160"
                        class="w-48"
                    />
                </Field>
                <Button variant="outline" size="icon" title="搜索批次" use-tooltip aria-label="搜索批次">
                    <Search aria-hidden="true" />
                </Button>
            </form>
            <div class="flex items-center gap-2 text-sm">
                <Button
                    variant="ghost"
                    size="sm"
                    :disabled="batchPage <= 1 || batches.loading.value"
                    @click="batchPage--"
                >
                    上一页批次
                </Button>
                <span class="tabular-nums">{{ batchPage }}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    :disabled="
                        batches.loading.value ||
                        !!batches.error.value ||
                        batchPage * 20 >= (batches.data.value?.total ?? 0)
                    "
                    @click="batchPage++"
                >
                    下一页批次
                </Button>
            </div>
        </div>
        <div
            v-if="batches.error.value || selectedBatch.error.value || inventoryContext.error.value"
            role="alert"
            class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
        >
            <p class="text-destructive">
                {{ batches.error.value || selectedBatch.error.value || inventoryContext.error.value }}
            </p>
            <Button
                variant="outline"
                size="sm"
                @click="
                    batches.reload();
                    selectedBatch.reload();
                    inventoryContext.refresh();
                "
            >
                重新加载批次与权限
            </Button>
        </div>
        <div v-if="selectedBatch.data.value" class="space-y-4 border-b py-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-3">
                    <h3 class="font-semibold">{{ selectedBatch.data.value.batchNumber }}</h3>
                    <StateBadge :tone="selectedBatch.data.value.archivedAt ? 'neutral' : 'success'">
                        {{ selectedBatch.data.value.archivedAt ? '已归档' : '有效' }}
                    </StateBadge>
                </div>
                <Button variant="ghost" size="sm" @click="router.push(`/main/material/detail/${id}/batch/${batchId}`)">
                    查看批次详情
                    <ArrowRight aria-hidden="true" />
                </Button>
            </div>
            <dl class="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                    <dt class="text-muted-foreground">生产日期</dt>
                    <dd class="mt-1">{{ selectedBatch.data.value.manufacturedOn ?? '未填写' }}</dd>
                </div>
                <div>
                    <dt class="text-muted-foreground">有效期</dt>
                    <dd class="mt-1">
                        {{
                            selectedBatch.data.value.expiry.kind === 'DATED'
                                ? selectedBatch.data.value.expiry.date
                                : selectedBatch.data.value.expiry.kind === 'NONE'
                                  ? '无期限'
                                  : '未知'
                        }}
                    </dd>
                </div>
                <div>
                    <dt class="text-muted-foreground">
                        {{ inventorySearch ? '匹配库存实例' : '本批次库存实例' }}
                    </dt>
                    <dd class="mt-1 tabular-nums">{{ inventoryData ? inventoryData.total : '—' }}</dd>
                </div>
            </dl>
            <p
                v-if="selectedBatch.data.value.notes"
                class="whitespace-pre-wrap break-words text-sm text-muted-foreground"
            >
                {{ selectedBatch.data.value.notes }}
            </p>
        </div>
        <div
            v-if="inventoryError"
            role="alert"
            class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
        >
            <p class="text-sm text-destructive">{{ inventoryError }}</p>
            <Button variant="outline" size="sm" @click="inventory.refresh">重新加载</Button>
        </div>
        <DataTable
            v-model:query="inventoryQuery"
            v-model:pagination="inventoryPagination"
            class="mt-4"
            :data="inventoryRows"
            :server-total="inventoryTotal"
            :columns="inventoryColumns"
            :actions="inventoryActions"
            :filtering="false"
            :busy="inventoryLoading"
            :preview="(row) => (inventoryPreviewId = row.id)"
            :active-id="inventoryPreviewId"
            search-label="搜索库存实例"
            :empty-text="
                inventoryError
                    ? '库存实例加载失败'
                    : inventoryLoading
                      ? '正在读取库存实例'
                      : batchId
                        ? '当前批次暂无符合条件的库存实例'
                        : '当前材料暂无符合条件的库存实例'
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
    <InventoryStockInspector v-model:id="inventoryPreviewId" />
    <InventoryReceiptDialog
        v-model:open="receiptOpen"
        :scope="inventoryScope"
        :initial-material-id="id"
        :initial-batch-id="batchId"
        :can-receive="
            !inventoryContext.loading.value &&
            !inventoryContext.error.value &&
            (inventoryContext.data.value?.capabilities.receive ?? false)
        "
        :can-manage-batch="inventoryContext.data.value?.capabilities.manageBatch ?? false"
        :business-date="inventoryContext.data.value?.businessDate"
        :on-committed="afterReceipt"
        :sync-failure="syncFailure"
        @refresh-context="inventoryContext.refresh"
    />
</template>
