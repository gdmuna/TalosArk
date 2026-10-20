<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowLeftRight, ArrowRight, CalendarDays, Package, MapPin } from '@lucide/vue';
import type { InventoryQuery } from '@/module/inventory';
import {
    useInventoryDataSource,
    useInventoryRead,
    useInventoryScope,
    InventoryMovementList,
    InventoryTransactionInspector,
    inventoryStatusLabel,
    inventoryStatusTone,
} from '@/module/inventory';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import InventoryPermissionSetup from './component/InventoryPermissionSetup.vue';
import ResourceSection from '../resource/ResourceSection.vue';
import ResourceSummary from '../resource/ResourceSummary.vue';
import ResourceEmpty from '../resource/ResourceEmpty.vue';
import ResourceFactList from '../resource/ResourceFactList.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const source = useInventoryDataSource();
const scope = useInventoryScope();
const query = ref<InventoryQuery>({ page: 1, pageSize: 10, q: '' });
const key = computed(() => (scope.value ? JSON.stringify(scope.value) : ''));
const context = useInventoryRead(key, (currentScope, signal) => {
    if (!source) return Promise.reject(new Error('库存数据源未连接'));
    return source.context(currentScope, signal);
});
const list = useInventoryRead(key, (currentScope, signal) => {
    if (!source) return Promise.reject(new Error('库存数据源未连接'));
    return source.list(currentScope, query.value, signal);
});
const movements = useInventoryRead(key, (currentScope, signal) => {
    if (!source) return Promise.reject(new Error('库存数据源未连接'));
    return source.transactions(currentScope, { page: 1, pageSize: 5, q: '' }, signal);
});
const transactionId = ref('');
const contextData = computed(() => context.data.value);
const listData = computed(() => list.data.value);
const listItems = computed(() => listData.value?.items ?? []);
const capabilityLabel = (value: boolean | undefined) => (value === undefined ? '—' : value ? '已授权' : '未授权');
async function refresh() {
    const results = await Promise.all([context.refresh(), list.refresh(), movements.refresh()]);
    return results.every(Boolean);
}
</script>

<template>
    <ResourcePage label="库存概览">
        <InventoryPermissionSetup :on-committed="refresh" />
        <div
            v-if="context.error.value || list.error.value"
            role="alert"
            class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
        >
            <p class="text-sm text-destructive">{{ context.error.value || list.error.value }}</p>
            <Button variant="outline" @click="refresh">重新加载</Button>
        </div>
        <ResourceSummary
            :items="[
                {
                    label: '库存实例',
                    value: listData?.total ?? '—',
                    icon: Package,
                    to: listData ? '/main/inventory/ledger' : undefined,
                },
                { label: '业务日期', value: contextData?.businessDate ?? '—', icon: CalendarDays },
                {
                    label: '库存流水',
                    value: movements.data.value?.total ?? '—',
                    icon: ArrowLeftRight,
                    to: movements.data.value ? '/main/inventory/transaction' : undefined,
                },
            ]"
        />
        <div class="grid min-w-0 gap-8 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div class="min-w-0 space-y-7">
                <ResourceSection title="最近库存流水">
                    <template #actions>
                        <Button variant="ghost" size="sm" @click="router.push('/main/inventory/transaction')">
                            查看全部
                            <ArrowRight aria-hidden="true" />
                        </Button>
                    </template>
                    <div v-if="movements.error.value" role="alert" class="space-y-3 text-sm">
                        <p class="text-destructive">{{ movements.error.value }}</p>
                        <Button variant="outline" size="sm" @click="movements.refresh">重新加载流水</Button>
                    </div>
                    <ResourceEmpty
                        v-else-if="movements.loading.value && !movements.data.value"
                        text="正在加载库存流水"
                    />
                    <ResourceEmpty v-else-if="!movements.data.value?.items.length" text="此工作区暂无库存流水" />
                    <InventoryMovementList
                        v-else
                        :items="movements.data.value.items"
                        @select="transactionId = $event"
                    />
                </ResourceSection>
                <ResourceSection title="最近入库">
                    <template #actions>
                        <Button variant="ghost" size="sm" @click="router.push('/main/inventory/ledger')">
                            查看库存列表
                        </Button>
                        <Button variant="ghost" size="sm" @click="router.push('/main/inventory/transaction')">
                            查看流水
                        </Button>
                    </template>
                    <ResourceEmpty v-if="list.loading.value && !listData" text="正在加载库存" />
                    <ResourceEmpty v-else-if="list.error.value && !listData" text="库存读取失败，请重新加载" />
                    <ResourceEmpty v-else-if="!listItems.length" text="暂无库存实例" />
                    <ul v-else class="divide-y text-sm">
                        <li v-for="item in listItems.slice(0, 5)" :key="item.id">
                            <button
                                class="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-muted/40"
                                @click="router.push(`/main/inventory/detail/${encodeURIComponent(item.id)}`)"
                            >
                                <span class="min-w-0">
                                    <span class="block break-words font-medium">{{ item.material.name }}</span>
                                    <span class="mt-1 block text-xs text-muted-foreground">{{ item.code }}</span>
                                </span>
                                <StateBadge :tone="inventoryStatusTone[item.status]">
                                    {{ inventoryStatusLabel[item.status] }}
                                </StateBadge>
                                <span class="shrink-0 tabular-nums text-muted-foreground">
                                    {{ item.quantity }} {{ item.quantityUnit }}
                                </span>
                            </button>
                        </li>
                    </ul>
                </ResourceSection>
            </div>
            <aside class="min-w-0 space-y-7">
                <ResourceSection title="常用操作">
                    <div class="divide-y">
                        <Button
                            variant="ghost"
                            class="h-12 w-full justify-between rounded-none px-0"
                            @click="router.push('/main/inventory/ledger')"
                        >
                            <span class="flex items-center gap-3">
                                <Package aria-hidden="true" />
                                查看库存台账
                            </span>
                            <ArrowRight aria-hidden="true" />
                        </Button>
                        <Button
                            variant="ghost"
                            class="h-12 w-full justify-between rounded-none px-0"
                            @click="router.push('/main/inventory/storage-topology')"
                        >
                            <span class="flex items-center gap-3">
                                <MapPin aria-hidden="true" />
                                浏览存储位置
                            </span>
                            <ArrowRight aria-hidden="true" />
                        </Button>
                    </div>
                </ResourceSection>
                <ResourceSection title="当前工作区权限">
                    <ResourceFactList
                        :fields="[
                            { label: '登记入库', value: capabilityLabel(contextData?.capabilities.receive) },
                            { label: '资料更正', value: capabilityLabel(contextData?.capabilities.updateFacts) },
                            { label: '容器搬迁', value: capabilityLabel(contextData?.capabilities.transfer) },
                            { label: '批次维护', value: capabilityLabel(contextData?.capabilities.manageBatch) },
                        ]"
                    />
                </ResourceSection>
            </aside>
        </div>
        <InventoryTransactionInspector v-model:id="transactionId" />
    </ResourcePage>
</template>
