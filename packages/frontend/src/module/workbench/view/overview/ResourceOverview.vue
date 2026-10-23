<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRight, Bell, Building2, ClipboardCheck, FlaskConical, ListTodo, Package, Plus } from '@lucide/vue';
import { Button } from '@/ui/button';
import { useWorkbenchOverview } from '../../model/overview';
import { workbenchPage } from '../../navigation';
import OverviewSection from './OverviewSection.vue';

const { material, inventory, facilities, approvalSummary, approvalRequests } = useWorkbenchOverview();
const summaries = computed(() => [
    {
        id: 'material',
        label: '有效材料',
        count: material.data?.active,
        status: material.status,
        detail: material.data ? `已归档 ${material.data.archived} 项` : '',
        icon: FlaskConical,
        path: '/main/material/list',
        color: 'bg-primary-soft text-primary-soft-foreground',
    },
    {
        id: 'inventory',
        label: '库存实例',
        count: inventory.data?.total,
        status: inventory.status,
        detail: '当前工作区的库存台账',
        icon: Package,
        path: '/main/inventory/ledger',
        color: 'bg-warning-soft text-warning-soft-foreground',
    },
    {
        id: 'facilities',
        label: '可访问设施',
        count: facilities.data?.total,
        status: facilities.status,
        detail: '当前工作区未归档设施',
        icon: Building2,
        path: '/main/inventory/storage-topology',
        color: 'bg-success-soft text-success-soft-foreground',
    },
]);
const queues = computed(() => [
    {
        ...workbenchPage.task,
        label: '待执行申请',
        icon: ListTodo,
        detail: approvalSummary.data ? `${approvalSummary.data.pendingExecution} 条明细待执行` : '暂不可用',
    },
    {
        ...workbenchPage.approval,
        icon: ClipboardCheck,
        detail: approvalSummary.data ? `${approvalSummary.data.pendingReview} 份申请待审批` : '暂不可用',
    },
    { ...workbenchPage.exception, icon: Bell, detail: '提醒服务尚未接入' },
]);
const summaryStatus = (status: string) =>
    status === 'loading' ? '加载中' : status === 'forbidden' ? '无查看权限' : '暂不可用';
</script>

<template>
    <main aria-label="工作台总览" class="min-w-0 p-4 pt-2 lg:p-6 lg:pt-2">
        <div class="mx-auto w-full max-w-[1200px] space-y-7" data-slot="workbench-overview">
            <section aria-label="工作概览" class="flex flex-wrap gap-3">
                <RouterLink
                    v-for="item in summaries"
                    :key="item.id"
                    :to="item.path"
                    :data-summary="item.id"
                    class="group flex w-64 max-w-full items-start gap-3 rounded-lg border bg-card p-4 shadow-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <span :class="['flex size-10 shrink-0 items-center justify-center rounded-md', item.color]">
                        <component :is="item.icon" class="size-5" aria-hidden="true" />
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-sm">{{ item.label }}</span>
                        <span class="mt-1 block text-2xl font-semibold tabular-nums">{{ item.count ?? '—' }}</span>
                        <span class="mt-2 block text-xs text-muted-foreground">
                            {{ item.status === 'ready' ? item.detail : summaryStatus(item.status) }}
                        </span>
                    </span>
                    <ArrowRight class="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </RouterLink>
            </section>

            <div class="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div class="min-w-0 space-y-7">
                    <OverviewSection
                        title="待我审批"
                        :status="approvalRequests.status"
                        :error="approvalRequests.error"
                        :empty="!approvalRequests.data?.items.length"
                        empty-label="暂无待审批申请"
                        :path="workbenchPage.approval.path"
                        @refresh="approvalRequests.refresh"
                    >
                        <ul class="divide-y border-y">
                            <li v-for="item in approvalRequests.data?.items" :key="item.id">
                                <RouterLink
                                    :to="`/main/workbench/request/${item.id}`"
                                    class="flex items-center gap-3 px-2.5 py-3 transition-colors hover:bg-accent"
                                >
                                    <ClipboardCheck class="size-4 shrink-0 text-primary" aria-hidden="true" />
                                    <span class="min-w-0 flex-1">
                                        <span class="block truncate font-medium">{{ item.title }}</span>
                                        <span class="mt-1 block text-xs text-muted-foreground">
                                            {{ item.requesterName }} · {{ item.totalLines }} 件实物
                                        </span>
                                    </span>
                                    <ArrowRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </RouterLink>
                            </li>
                        </ul>
                    </OverviewSection>
                    <OverviewSection
                        title="最近更新的材料"
                        :status="material.status"
                        :error="material.error"
                        :empty="!material.data?.recent.length"
                        empty-label="此工作区暂无材料"
                        path="/main/material/list"
                        @refresh="material.refresh"
                    >
                        <template #actions>
                            <Button v-if="material.data?.capabilities.create" variant="ghost" size="sm" as-child>
                                <RouterLink :to="{ path: '/main/material/list', query: { create: '1' } }">
                                    <Plus aria-hidden="true" />
                                    新建材料
                                </RouterLink>
                            </Button>
                        </template>
                        <ul class="divide-y border-y">
                            <li v-for="item in material.data?.recent" :key="item.id">
                                <RouterLink
                                    :to="`/main/material/detail/${item.id}`"
                                    class="flex min-w-0 items-center gap-3 px-2.5 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                    <FlaskConical class="size-4 shrink-0 text-primary" aria-hidden="true" />
                                    <span class="min-w-0 flex-1">
                                        <span class="block truncate font-medium">{{ item.name }}</span>
                                        <span v-if="item.code" class="mt-1 block text-xs text-muted-foreground">
                                            {{ item.code }}
                                        </span>
                                    </span>
                                    <ArrowRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </RouterLink>
                            </li>
                        </ul>
                    </OverviewSection>
                    <OverviewSection
                        title="最近入库"
                        :status="inventory.status"
                        :error="inventory.error"
                        :empty="!inventory.data?.items.length"
                        empty-label="此工作区暂无库存实例"
                        path="/main/inventory/ledger"
                        @refresh="inventory.refresh"
                    >
                        <ul class="divide-y border-y">
                            <li v-for="item in inventory.data?.items" :key="item.id">
                                <RouterLink
                                    :to="`/main/inventory/detail/${item.id}`"
                                    class="flex min-w-0 items-center gap-3 px-2.5 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                    <Package class="size-4 shrink-0 text-primary" aria-hidden="true" />
                                    <span class="min-w-0 flex-1">
                                        <span class="block truncate font-medium">
                                            {{ item.label || item.material.name }}
                                        </span>
                                        <span v-if="item.code" class="mt-1 block text-xs text-muted-foreground">
                                            {{ item.code }}
                                        </span>
                                    </span>
                                    <span class="shrink-0 text-sm tabular-nums">
                                        {{ item.quantity }} {{ item.quantityUnit }}
                                    </span>
                                </RouterLink>
                            </li>
                        </ul>
                    </OverviewSection>
                </div>
                <div class="min-w-0 space-y-7">
                    <section aria-label="工作队列">
                        <h2 class="mb-3 text-base font-semibold">工作队列</h2>
                        <ul class="divide-y border-y">
                            <li v-for="item in queues" :key="item.id">
                                <RouterLink
                                    :to="item.path"
                                    class="flex items-center gap-3 px-2.5 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                    <component
                                        :is="item.icon"
                                        class="size-4 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <span class="min-w-0 flex-1">
                                        <span class="block font-medium">{{ item.label }}</span>
                                        <span class="mt-1 block text-xs text-muted-foreground">{{ item.detail }}</span>
                                    </span>
                                    <ArrowRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </RouterLink>
                            </li>
                        </ul>
                    </section>
                    <OverviewSection
                        title="可访问设施"
                        :status="facilities.status"
                        :error="facilities.error"
                        :empty="!facilities.data?.items.length"
                        empty-label="此工作区暂无可访问设施"
                        path="/main/inventory/storage-topology"
                        @refresh="facilities.refresh"
                    >
                        <ul class="divide-y border-y">
                            <li v-for="item in facilities.data?.items" :key="item.id">
                                <RouterLink
                                    :to="{
                                        path: '/main/inventory/storage-topology',
                                        query: { facility: item.id },
                                    }"
                                    class="flex min-w-0 items-center gap-3 px-2.5 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                    <Building2 class="size-4 shrink-0 text-primary" aria-hidden="true" />
                                    <span class="min-w-0 flex-1">
                                        <span class="block truncate font-medium">{{ item.name }}</span>
                                        <span class="mt-1 block text-xs text-muted-foreground">
                                            {{ item.disabledAt ? '已停用' : item.location || item.code }}
                                        </span>
                                    </span>
                                    <ArrowRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </RouterLink>
                            </li>
                        </ul>
                    </OverviewSection>
                </div>
            </div>
        </div>
    </main>
</template>
