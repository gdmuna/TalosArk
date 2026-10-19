<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftRight, Package, Pencil } from '@lucide/vue';
import type { InventoryQuery } from '@/module/inventory';
import {
    InventoryFactsEditor,
    InventoryTransactionInspector,
    inventoryStatusLabel,
    inventoryExpiryLabel,
    inventoryTransactionLabel,
    useInventoryDataSource,
    useInventoryRead,
} from '@/module/inventory';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { useNavigationStore } from '@/platform/navigation';
import { Button } from '@/ui/button';
import { SheetInspector, CopyableId } from '@/component/inspector';
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
const preview = ref(false);
const editorOpen = ref(false),
    transactionId = ref('');
watch(
    [scope, id],
    () => {
        preview.value = editorOpen.value = false;
        transactionId.value = '';
    },
    { flush: 'sync' }
);
watch(editorOpen, (value) => {
    if (value) void context.refresh();
});
provideBreadcrumbs(() => [
    { id: 'inventory-list', label: '库存列表', to: returnTo.value },
    { id: 'inventory-stock', label: data.value?.code ?? '库存实例详情' },
    { id: 'inventory-view', label: tabs.find((item) => item.id === view.value)?.label ?? '概览' },
]);
</script>

<template>
    <ResourceDetailPage label="库存实例详情">
        <template #header>
            <ResourceObjectHeader
                :id="id"
                :title="data?.code ?? '库存实例详情'"
                :icon="Package"
                :status="statusLabel"
                :back-to="returnTo"
                back-label="库存列表"
            >
                <Button
                    variant="outline"
                    :disabled="!data?.capabilities.updateFacts || loading || !!error || !context.data.value"
                    @click="editorOpen = true"
                >
                    <Pencil aria-hidden="true" />
                    更正资料
                </Button>
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
        <ResourceEmpty v-else-if="!data" text="当前工作区没有可访问的库存实例" />
        <template v-else-if="view === 'overview'">
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
                        { label: '备注', value: data.notes || '无' },
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
            <div class="grid min-w-0 gap-8 @min-[1000px]:grid-cols-2">
                <ResourceSection title="当前位置">
                    <ResourceFactList
                        :fields="[
                            {
                                label: '位置',
                                value: data.location?.path ?? (data.locationRestricted ? '位置受限' : '未分配'),
                            },
                            { label: '位置权限', value: data.locationRestricted ? '受限' : '正常' },
                        ]"
                    />
                </ResourceSection>
                <ResourceSection title="最近流转">
                    <template #actions>
                        <Button variant="ghost" size="sm" @click="router.push(transactionPath)">全部流水</Button>
                    </template>
                    <p v-if="transactions.error.value" class="text-sm text-destructive">
                        {{ transactions.error.value }}
                    </p>
                    <ResourceEmpty
                        v-else-if="transactions.loading.value && !transactionItems.length"
                        text="正在加载流水"
                    />
                    <ResourceEmpty v-else-if="!transactionItems.length" text="暂无流转记录" />
                    <ul v-else class="divide-y text-sm">
                        <li v-for="item in transactionItems.slice(0, 5)" :key="item.id">
                            <button
                                class="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-muted/40"
                                @click="transactionId = item.id"
                            >
                                <span>{{ inventoryTransactionLabel(item.type) }}</span>
                                <span class="text-muted-foreground">
                                    {{ new Date(item.occurredAt).toLocaleString('zh-CN', { hour12: false }) }}
                                </span>
                            </button>
                        </li>
                    </ul>
                </ResourceSection>
            </div>
            <div class="flex justify-end"><Button variant="outline" @click="preview = true">查看实例摘要</Button></div>
        </template>
        <ResourceSection v-else title="流转记录">
            <template #actions>
                <Button variant="ghost" size="sm" @click="router.push(transactionPath)">
                    全部流水（{{ transactions.data.value?.total ?? '—' }}）
                </Button>
            </template>
            <ResourceEmpty v-if="transactions.loading.value" text="正在加载流转记录" />
            <p v-else-if="transactions.error.value" class="text-sm text-destructive">{{ transactions.error.value }}</p>
            <ResourceEmpty v-else-if="!transactionItems.length" text="暂无流转记录" />
            <ul v-else class="divide-y text-sm">
                <li v-for="item in transactionItems" :key="item.id">
                    <button class="grid w-full gap-1 py-3 text-left hover:bg-muted/40" @click="transactionId = item.id">
                        <span class="font-medium">{{ inventoryTransactionLabel(item.type) }}</span>
                        <span class="text-muted-foreground">
                            {{ new Date(item.occurredAt).toLocaleString('zh-CN', { hour12: false }) }} ·
                            {{ item.reason ?? '无备注' }}
                        </span>
                        <span class="text-xs text-muted-foreground">{{ item.lines.length }} 条明细</span>
                    </button>
                </li>
            </ul>
        </ResourceSection>
        <SheetInspector v-model:open="preview" title="库存实例摘要" description="当前库存事实">
            <div v-if="data" class="space-y-4 p-6">
                <CopyableId :value="data.id" label="库存实例 ID" />
                <p class="text-sm">{{ data.material.name }} · {{ data.quantity }} {{ data.quantityUnit }}</p>
            </div>
        </SheetInspector>
        <InventoryFactsEditor
            v-if="data"
            v-model:open="editorOpen"
            :stock="data"
            :business-date="context.loading.value || context.error.value ? undefined : context.data.value?.businessDate"
            :on-committed="refresh"
            @refresh-context="context.refresh"
        />
        <InventoryTransactionInspector v-model:id="transactionId" />
    </ResourceDetailPage>
</template>
