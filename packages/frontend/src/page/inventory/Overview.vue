<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowLeftRight, Package, TriangleAlert } from '@lucide/vue';
import type { InventoryQuery } from '@/module/inventory';
import { useInventoryDataSource, useInventoryRead, useInventoryScope } from '@/module/inventory';
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
const contextData = computed(() => context.data.value);
const listData = computed(() => list.data.value);
const listItems = computed(() => listData.value?.items ?? []);
const hasPermission = computed(() => contextData.value?.capabilities.read ?? false);
const capabilityLabel = (value: boolean | undefined) => (value === undefined ? '—' : value ? '已授权' : '未授权');
async function refresh() {
    const results = await Promise.all([context.refresh(), list.refresh()]);
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
                { label: '库存实例', value: listData?.total ?? '—', icon: Package },
                { label: '业务日期', value: contextData?.businessDate ?? '—', icon: Package },
                {
                    label: '库存读取',
                    value: contextData ? (hasPermission ? '可用' : '受限') : '—',
                    icon: TriangleAlert,
                },
                {
                    label: '流水记录',
                    value: contextData ? (hasPermission ? '可查看' : '受限') : '—',
                    icon: ArrowLeftRight,
                },
            ]"
        />
        <div class="grid min-w-0 gap-8 @4xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <ResourceSection title="最近入库">
                <template #actions>
                    <Button variant="ghost" size="sm" @click="router.push('/main/inventory/ledger')">
                        查看库存列表
                    </Button>
                    <Button variant="ghost" size="sm" @click="router.push('/main/inventory/transaction')">
                        查看流水
                    </Button>
                </template>
                <ResourceEmpty v-if="list.loading.value" text="正在加载库存" />
                <ResourceEmpty v-else-if="list.error.value" text="库存读取失败，请重新加载" />
                <ResourceEmpty v-else-if="!listItems.length" text="暂无库存实例" />
                <ul v-else class="divide-y text-sm">
                    <li v-for="item in listItems.slice(0, 5)" :key="item.id">
                        <button
                            class="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-muted/40"
                            @click="router.push(`/main/inventory/detail/${encodeURIComponent(item.id)}`)"
                        >
                            <span>{{ item.material.name }} · {{ item.code }}</span>
                            <span class="shrink-0 text-muted-foreground">
                                {{ item.quantity }} {{ item.quantityUnit }}
                            </span>
                        </button>
                    </li>
                </ul>
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
        </div>
    </ResourcePage>
</template>
