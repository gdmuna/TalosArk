<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    ArrowLeftRight,
    ArrowUpRight,
    Package,
    Pencil,
    MapPin,
    Minus,
    ArrowRightLeft,
    Scale,
    Archive,
} from '@lucide/vue';
import type { InventoryQuery, InventoryActionKind } from '@/module/inventory';
import {
    InventoryFactsEditor,
    InventoryTransactionInspector,
    InventoryMovementList,
    InventoryStockInspector,
    inventoryStatusLabel,
    inventoryStatusTone,
    inventoryExpiryLabel,
    useInventoryDataSource,
    useInventoryRead,
    useInventoryActionStore,
    inventoryActionLabel,
} from '@/module/inventory';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { useNavigationStore } from '@/platform/navigation';
import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/ui/dropdown-menu';
import InventoryActionDialog from '../component/InventoryActionDialog.vue';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceViewNav from '../../resource/ResourceViewNav.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceFactList from '../../resource/ResourceFactList.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';
import { useResourceView } from '../../resource/useResourceView';

const route = useRoute();
const router = useRouter();
const navigation = useNavigationStore();
const source = useInventoryDataSource();
const actionStore = useInventoryActionStore();
const actionOpen = ref(false);
const actionKind = ref<InventoryActionKind>();
const actionIcons = { consume: Minus, transfer: ArrowRightLeft, adjust: Scale, dispose: Archive };
const actionKinds = ['consume', 'transfer', 'adjust', 'dispose'] as const;
const id = computed(() => String(route.params.resourceId ?? ''));
const { data, loading, error, refresh, scope } = useInventoryRead(id, (currentScope, signal) => {
    if (!source) return Promise.reject(new Error('库存数据源未连接'));
    return source.get(currentScope, id.value, signal);
});
const transactionKey = computed(() => (scope.value && id.value ? JSON.stringify([scope.value, id.value]) : ''));
const transactionQuery = computed<InventoryQuery>(() => ({ page: 1, pageSize: 10, q: '', stockItemId: id.value }));
const transactions = useInventoryRead(transactionKey, (currentScope, signal) => {
    if (!source) return Promise.reject(new Error('库存数据源未连接'));
    return source.transactions(currentScope, transactionQuery.value, signal);
});
const transactionItems = computed(() => transactions.data.value?.items ?? []);
const tabs = [
    { id: 'overview', label: '概览' },
    { id: 'movement', label: '流转记录' },
];
const { view, select } = useResourceView(tabs.map((item) => item.id));
const context = useInventoryRead(
    computed(() => (scope.value ? JSON.stringify(scope.value) : '')),
    (currentScope, signal) => {
        if (!source) return Promise.reject(new Error('库存数据源未连接'));
        return source.context(currentScope, signal);
    }
);
const materialPath = computed(() =>
    data.value ? `/main/material/detail/${encodeURIComponent(data.value.material.id)}` : ''
);
const statusLabel = computed(() => (data.value ? inventoryStatusLabel[data.value.status] : undefined));
const returnTo = computed(() => navigation.lastLocation('/main/inventory/ledger'));
const transactionPath = computed(() => ({ path: '/main/inventory/transaction', query: { stockItemId: id.value } }));
const editorOpen = ref(false),
    transactionId = ref('');
const previewId = ref('');
watch(
    [scope, id],
    () => {
        editorOpen.value = false;
        actionOpen.value = false;
        transactionId.value = '';
        previewId.value = '';
    },
    { flush: 'sync' }
);
watch(editorOpen, (value) => {
    if (value) void context.refresh();
});
provideBreadcrumbs(() => [
    { id: 'inventory-list', label: '库存列表', to: returnTo.value },
    { id: 'inventory-stock', label: data.value?.code ?? '库存实例详情' },
]);
const locationPath = computed(() =>
    data.value?.location
        ? {
              path: '/main/inventory/storage-topology',
              query: { facility: data.value.location.facilityId, node: data.value.location.nodeId },
          }
        : undefined
);
</script>

<template>
    <ResourceDetailPage label="库存实例详情">
        <template #header>
            <ResourceObjectHeader
                :id="id"
                :title="data?.code ?? '库存实例详情'"
                :icon="Package"
                :subtitle="data ? `${data.material.name}${data.label ? ` · ${data.label}` : ''}` : undefined"
                :status="statusLabel"
                :status-tone="data ? inventoryStatusTone[data.status] : undefined"
                :back-to="returnTo"
                back-label="库存列表"
            >
                <Button
                    v-if="actionStore.current(scope) || actionStore.recoveryError"
                    variant="outline"
                    @click="actionOpen = true"
                >
                    核对上次库存操作
                </Button>
                <DropdownMenu v-else>
                    <DropdownMenuTrigger as-child>
                        <Button :disabled="!data || loading || !!error || actionStore.busy">库存操作</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            v-for="kind in actionKinds"
                            :key="kind"
                            :disabled="!data?.actions[kind]"
                            @select="
                                actionKind = kind;
                                actionOpen = true;
                            "
                        >
                            <component :is="actionIcons[kind]" aria-hidden="true" />
                            {{ inventoryActionLabel[kind] }}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button
                    variant="outline"
                    :disabled="!data?.capabilities.updateFacts || loading || !!error || !context.data.value"
                    @click="editorOpen = true"
                >
                    <Pencil aria-hidden="true" />
                    更正资料
                </Button>
                <template v-if="data" #summary>
                    <dl class="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[auto_auto_minmax(0,1fr)]">
                        <div>
                            <dt class="text-muted-foreground">当前数量</dt>
                            <dd class="mt-1 text-lg font-semibold tabular-nums">
                                {{ data.quantity }}
                                <span class="text-sm font-normal">{{ data.quantityUnit }}</span>
                            </dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">来源批次</dt>
                            <dd class="mt-1">
                                <RouterLink
                                    v-if="data.batch"
                                    :to="`/main/material/detail/${data.material.id}/batch/${data.batch.id}`"
                                    class="hover:underline focus-visible:underline"
                                >
                                    {{ data.batch.batchNumber }}
                                </RouterLink>
                                <template v-else>未关联</template>
                            </dd>
                        </div>
                        <div class="min-w-0">
                            <dt class="text-muted-foreground">当前位置</dt>
                            <dd class="mt-1 break-words leading-6">
                                {{ data.location?.path ?? (data.locationRestricted ? '位置受限' : '未分配') }}
                            </dd>
                        </div>
                    </dl>
                </template>
                <Button variant="outline" @click="router.push(transactionPath)">
                    <ArrowLeftRight aria-hidden="true" />
                    查看流水
                </Button>
            </ResourceObjectHeader>
            <ResourceViewNav :items="tabs" :active="view" label="库存实例视图" @select="select" />
        </template>
        <div v-if="error" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <p class="text-sm text-destructive">{{ error }}</p>
            <Button variant="outline" @click="refresh">重新加载</Button>
        </div>
        <div v-if="context.error.value" role="alert" class="flex items-center justify-between gap-3 text-sm">
            <p class="text-destructive">{{ context.error.value }}</p>
            <Button variant="outline" @click="context.refresh">重新加载权限与业务日期</Button>
        </div>
        <ResourceEmpty v-if="loading && !data" text="正在加载库存实例" />
        <ResourceEmpty v-else-if="!data" :text="error ? '库存实例加载失败' : '当前工作区没有可访问的库存实例'" />
        <div
            v-else-if="view === 'overview'"
            class="grid min-w-0 gap-8 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
        >
            <div class="min-w-0 space-y-7">
                <ResourceSection title="实例信息">
                    <template #actions>
                        <Button variant="ghost" size="sm" @click="router.push(materialPath)">
                            {{ data.material.name }}
                        </Button>
                    </template>
                    <ResourceFactList
                        :fields="[
                            { label: '实例编号', value: data.code },
                            { label: '材料', value: data.material.name },
                            { label: '批次', value: data.batch?.batchNumber ?? '未关联' },
                            { label: '初始数量', value: `${data.initialQuantity} ${data.quantityUnit}` },
                            { label: '当前数量', value: `${data.quantity} ${data.quantityUnit}` },
                            { label: '状态', value: statusLabel },
                            { label: '标签', value: data.label || '未填写' },
                            {
                                label: '入库时间',
                                value: new Date(data.createdAt).toLocaleString('zh-CN', { hour12: false }),
                            },
                        ]"
                    />
                    <p v-if="data.notes" class="whitespace-pre-wrap break-words text-sm leading-6">{{ data.notes }}</p>
                </ResourceSection>
                <ResourceSection title="日期与有效期">
                    <ResourceFactList
                        :fields="[
                            {
                                label: '有效期',
                                value:
                                    data.expiry.kind === 'DATED'
                                        ? data.expiry.date
                                        : data.expiry.kind === 'NONE'
                                          ? '无期限'
                                          : '未知',
                            },
                            { label: '有效期风险', value: inventoryExpiryLabel[data.expiryRisk] },
                            { label: '生产日期', value: data.manufacturedOn ?? '未填写' },
                            { label: '到货日期', value: data.receivedOn ?? '未填写' },
                            {
                                label: '开封时间',
                                value: data.openedAt
                                    ? new Date(data.openedAt).toLocaleString('zh-CN', { hour12: false })
                                    : '未填写',
                            },
                        ]"
                    />
                </ResourceSection>
            </div>
            <aside class="min-w-0 space-y-7">
                <ResourceSection title="当前位置">
                    <div class="flex items-start gap-3 text-sm leading-6">
                        <MapPin class="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <p class="break-words">
                            {{ data.location?.path ?? (data.locationRestricted ? '位置受限' : '未分配') }}
                        </p>
                    </div>
                    <Button v-if="locationPath" variant="outline" size="sm" @click="router.push(locationPath)">
                        <ArrowUpRight aria-hidden="true" />
                        查看存储位置
                    </Button>
                </ResourceSection>
                <ResourceSection title="最近流转">
                    <template #actions>
                        <Button variant="ghost" size="sm" @click="router.push(transactionPath)">全部流水</Button>
                    </template>
                    <div v-if="transactions.error.value" role="alert" class="space-y-2 text-sm">
                        <p class="text-destructive">{{ transactions.error.value }}</p>
                        <Button variant="outline" size="sm" @click="transactions.refresh">重新加载流水</Button>
                    </div>
                    <ResourceEmpty v-if="transactions.loading.value && !transactions.data.value" text="正在加载流水" />
                    <ResourceEmpty
                        v-else-if="!transactionItems.length"
                        :text="transactions.error.value ? '流转记录加载失败' : '暂无流转记录'"
                    />
                    <InventoryMovementList
                        v-else
                        :items="transactionItems.slice(0, 3)"
                        :stock-item-id="id"
                        @select="transactionId = $event"
                    />
                </ResourceSection>
            </aside>
            <div class="flex justify-end @min-[1000px]:col-span-2">
                <Button variant="outline" @click="previewId = id">查看实例摘要</Button>
            </div>
        </div>
        <ResourceSection v-else title="流转记录">
            <template #actions>
                <Button variant="ghost" size="sm" @click="router.push(transactionPath)">
                    全部流水（{{ transactions.data.value?.total ?? '—' }}）
                </Button>
            </template>
            <div v-if="transactions.error.value" role="alert" class="space-y-2 text-sm">
                <p class="text-destructive">{{ transactions.error.value }}</p>
                <Button variant="outline" size="sm" @click="transactions.refresh">重新加载流水</Button>
            </div>
            <ResourceEmpty v-if="transactions.loading.value && !transactions.data.value" text="正在加载流转记录" />
            <ResourceEmpty
                v-else-if="!transactionItems.length"
                :text="transactions.error.value ? '流转记录加载失败' : '暂无流转记录'"
            />
            <InventoryMovementList
                v-else
                :items="transactionItems"
                :stock-item-id="id"
                @select="transactionId = $event"
            />
        </ResourceSection>
        <InventoryFactsEditor
            v-if="data"
            v-model:open="editorOpen"
            :stock="data"
            :business-date="context.loading.value || context.error.value ? undefined : context.data.value?.businessDate"
            :on-committed="refresh"
            @refresh-context="context.refresh"
        />
        <InventoryTransactionInspector v-model:id="transactionId" />
        <InventoryActionDialog
            v-model:open="actionOpen"
            :scope="scope"
            :stock="data"
            :kind="actionKind"
            :on-committed="
                async () => {
                    transactionId = previewId = '';
                    const stockReady = await refresh();
                    const journalReady = await transactions.refresh();
                    return stockReady && journalReady;
                }
            "
        />
        <InventoryStockInspector v-model:id="previewId" />
    </ResourceDetailPage>
</template>
