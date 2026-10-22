<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    CalendarDays,
    Eye,
    MapPin,
    Package,
    Tag,
    Plus,
    Minus,
    ArrowRightLeft,
    Scale,
    Archive,
    ClipboardCheck,
} from '@lucide/vue';
import { useApprovalRead } from '@/module/approval';
import type { PaginationState } from '@tanstack/vue-table';
import type { InventoryQuery, InventoryStock, InventoryActionKind } from '@/module/inventory';
import {
    useInventoryDataSource,
    useInventoryRead,
    useInventoryReceiptStore,
    useInventoryActionStore,
    inventoryActionLabel,
} from '@/module/inventory';
import {
    inventoryStatusLabel,
    inventoryStatusTone,
    inventoryExpiryLabel,
    useInventoryScope,
    InventoryStockInspector,
} from '@/module/inventory';
import {
    DataTable,
    type DataTableAction,
    type DataTableColumn,
    type DataTableBulkAction,
} from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import InventoryReceiptDialog from './component/InventoryReceiptDialog.vue';
import InventoryReceiptBatchDialog from './component/InventoryReceiptBatchDialog.vue';
import InventoryActionDialog from './component/InventoryActionDialog.vue';
import { useResourceQuery } from '../resource/useResourceQuery';
import { useQueryCommand } from '@/platform/navigation';

const router = useRouter();
const route = useRoute();
const source = useInventoryDataSource();
const scope = useInventoryScope();
const approval = useApprovalRead(
    computed(() => 'context'),
    (source, current, signal) => source.context(current, signal)
);
const checked = ref<string[]>([]);
function apply(type: 'CONSUME' | 'TRANSFER', items: InventoryStock[]) {
    void router.push({ path: '/main/workbench/request/new', query: { type, stock: items.map((item) => item.id) } });
}
function canApply(row: InventoryStock, type: 'CONSUME' | 'TRANSFER') {
    return (
        !!row.location &&
        (type === 'CONSUME'
            ? !!approval.data.value?.capabilities.consumeApply &&
              row.status === 'IN_STOCK' &&
              row.expiryRisk !== 'EXPIRED'
            : !!approval.data.value?.capabilities.transferApply && ['IN_STOCK', 'DEPLETED'].includes(row.status))
    );
}
const bulkActions = computed<DataTableBulkAction<InventoryStock>[]>(() =>
    (['CONSUME', 'TRANSFER'] as const).map((type) => ({
        id: `apply-${type}`,
        label: type === 'CONSUME' ? '申请消耗' : '申请转移',
        icon: ClipboardCheck,
        disabled: (items) => !items.length || items.some((item) => !canApply(item, type)),
        run: (items) => apply(type, items),
    }))
);
const receiptStore = useInventoryReceiptStore();
const batchOpen = ref(false);
const receiptBatch = computed(() => receiptStore.batch.current(receiptStore.batchKey(scope.value)));
const actionStore = useInventoryActionStore();
const actionAttempt = computed(() => actionStore.current(scope.value));
const actionOpen = ref(false);
const actionStock = ref<InventoryStock>();
const actionKind = ref<InventoryActionKind>();
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
const { data, loading, error, failure, refresh } = useInventoryRead(key, (scope, signal) => {
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
watch(
    scope,
    () => {
        selectedId.value = '';
        checked.value = [];
        actionOpen.value = false;
        batchOpen.value = false;
        actionStock.value = undefined;
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
        align: 'right',
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
    ...(['consume', 'transfer', 'adjust', 'dispose'] as const).map((kind) => ({
        id: kind,
        label: inventoryActionLabel[kind],
        icon: { consume: Minus, transfer: ArrowRightLeft, adjust: Scale, dispose: Archive }[kind],
        disabled: (row: InventoryStock) =>
            !row.actions[kind] || !!actionAttempt.value || actionStore.busy || !!error.value,
        run: (row: InventoryStock) => {
            actionStock.value = row;
            actionKind.value = kind;
            actionOpen.value = true;
        },
    })),
    ...(['CONSUME', 'TRANSFER'] as const).map((type) => ({
        id: `apply-${type}`,
        label: type === 'CONSUME' ? '申请消耗' : '申请转移',
        icon: ClipboardCheck,
        disabled: (row: InventoryStock) => !canApply(row, type),
        run: (row: InventoryStock) => apply(type, [row]),
    })),
]);
</script>

<template>
    <ResourcePage label="库存列表" layout="data">
        <template #actions>
            <Button
                variant="outline"
                :disabled="
                    !receiptBatch &&
                    (recovering ||
                        receiptStore.busy ||
                        !context.data.value?.capabilities.receive ||
                        context.loading.value ||
                        !!context.error.value)
                "
                @click="batchOpen = true"
            >
                <Plus />
                {{ receiptBatch ? '核对批量入库' : '批量入库' }}
            </Button>
            <Button v-if="actionAttempt || actionStore.recoveryError" variant="outline" @click="actionOpen = true">
                核对上次库存操作
            </Button>
            <Button
                :disabled="
                    !!receiptBatch ||
                    (!recovering && (!context.data.value?.capabilities.receive || !!context.error.value || loading))
                "
                @click="receiptOpen = true"
            >
                <Plus aria-hidden="true" />
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
        <DataTable
            v-model:selected="checked"
            v-model:query="query"
            v-model:pagination="pagination"
            :selectable="(row) => canApply(row, 'CONSUME') || canApply(row, 'TRANSFER')"
            :bulk-actions="bulkActions"
            :server-total="total"
            :filtering="false"
            :data="rows"
            :columns="columns"
            :actions="actions"
            :busy="loading"
            :active-id="selectedId"
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
                        <span class="mt-1 block truncate text-xs text-muted-foreground">
                            {{ row.label || row.material.code }}
                        </span>
                    </span>
                </button>
            </template>
            <template #cell-status="{ row }">
                <StateBadge :tone="inventoryStatusTone[row.status]">
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
            <template #cell-quantity="{ row }">
                <span class="whitespace-nowrap tabular-nums">{{ row.quantity }} {{ row.quantityUnit }}</span>
            </template>
            <template #cell-location="{ row }">
                <span class="block truncate" :title="row.location?.path">
                    {{ row.location?.path ?? (row.locationRestricted ? '位置受限' : '未分配') }}
                </span>
            </template>
        </DataTable>
        <InventoryStockInspector v-model:id="selectedId" />
        <InventoryActionDialog
            v-model:open="actionOpen"
            :scope="scope"
            :stock="actionStock"
            :kind="actionKind"
            :sync-failure="failure"
            :on-committed="
                async () => {
                    selectedId = '';
                    return refresh();
                }
            "
        />
        <InventoryReceiptDialog
            v-model:open="receiptOpen"
            :scope="scope"
            :can-receive="
                !context.loading.value && !context.error.value && (context.data.value?.capabilities.receive ?? false)
            "
            :can-manage-batch="context.data.value?.capabilities.manageBatch ?? false"
            :business-date="context.data.value?.businessDate"
            :on-committed="async () => refresh()"
            :sync-failure="failure"
            @refresh-context="context.refresh"
        />
        <InventoryReceiptBatchDialog
            v-model:open="batchOpen"
            :scope="scope"
            :can-receive="
                !context.loading.value && !context.error.value && (context.data.value?.capabilities.receive ?? false)
            "
            :can-manage-batch="context.data.value?.capabilities.manageBatch ?? false"
            :business-date="context.data.value?.businessDate"
            :on-synchronized="async () => (await refresh()) && (await context.refresh())"
        />
    </ResourcePage>
</template>
