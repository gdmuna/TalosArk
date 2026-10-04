<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRight, Bell, ClipboardCheck, FileText, FlaskConical, ListTodo, Monitor, Package } from '@lucide/vue';
import { useWorkbenchStore } from '@/shared/stores';
import { exceptionTone, stateTone, isTaskOverdue, taskDisplayStatus, type Resource } from '@/shared/models/workbench';
import { formatTime, isToday } from '@/shared/utils/date-time';
import { Button } from '@/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/empty';
import StateBadge from '@/modules/state-badge/StateBadge.vue';
import ResourceDialog from '@/modules/workbench/ResourceDialog.vue';

const workbench = useWorkbenchStore();
const preview = ref<Resource | null>(null);
const paths = {
    tasks: '/main/workbench/my-task',
    approvals: '/main/workbench/pending-approval',
    exceptions: '/main/workbench/exception-alert',
};
const pendingTasks = computed(() =>
    workbench.currentTasks.filter((item) => item.status === '待处理').sort((a, b) => a.dueAt - b.dueAt)
);
const pendingApprovals = computed(() =>
    workbench.currentApprovals.filter((item) => item.status === '待审批').sort((a, b) => a.createdAt - b.createdAt)
);
const severityOrder = { 严重: 0, 一般: 1, 提示: 2 };
const unresolved = computed(() =>
    workbench.currentExceptions
        .filter((item) => item.status === '未处理')
        .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.createdAt - a.createdAt)
);
const summaries = computed(() => [
    {
        id: 'tasks',
        label: '未完成待办',
        count: pendingTasks.value.length,
        icon: ListTodo,
        path: paths.tasks,
        color: 'bg-primary-soft text-primary-soft-foreground',
        detail: `今日到期 ${pendingTasks.value.filter((item) => isToday(item.dueAt)).length} · 已逾期 ${pendingTasks.value.filter(isTaskOverdue).length}`,
    },
    {
        id: 'approvals',
        label: '待审批',
        count: pendingApprovals.value.length,
        icon: ClipboardCheck,
        path: paths.approvals,
        color: 'bg-warning-soft text-warning-soft-foreground',
        detail: '待审核的申请',
    },
    {
        id: 'exceptions',
        label: '异常与提醒',
        count: unresolved.value.length,
        icon: Bell,
        path: paths.exceptions,
        color: 'bg-caution-soft text-caution-soft-foreground',
        detail: `严重 ${unresolved.value.filter((item) => item.severity === '严重').length} · 一般 ${unresolved.value.filter((item) => item.severity === '一般').length} · 提醒 ${unresolved.value.filter((item) => item.severity === '提示').length}`,
    },
]);
const recentResources = computed(() =>
    [...workbench.overview.recentItems]
        .sort((a, b) => b.visitedAt - a.visitedAt)
        .flatMap((item) => {
            const resource = workbench.resourceById.get(item.resourceId);
            return resource ? [{ resource, visitedAt: item.visitedAt }] : [];
        })
        .slice(0, 4)
);
const resourceIcon = (resource: Resource) =>
    resource.kind === '设备'
        ? Monitor
        : resource.kind === '库存实例'
          ? Package
          : resource.kind === '文件'
            ? FileText
            : FlaskConical;
const resourceName = (id: string) => workbench.resourceById.get(id)?.name ?? '关联对象不可用';
</script>

<template>
    <main aria-label="工作台总览" class="min-w-0 p-4 pt-2 lg:p-6 lg:pt-2">
        <div class="mx-auto w-full max-w-[1200px] space-y-7" data-slot="workbench-overview">
            <section aria-label="工作概览" class="flex flex-wrap gap-3">
                <RouterLink
                    v-for="item in summaries"
                    :key="item.id"
                    :to="item.path"
                    :aria-label="`${item.label}，${item.count} 项`"
                    class="group flex w-64 max-w-full items-start gap-3 rounded-lg border bg-card p-4 shadow-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    :data-summary="item.id"
                >
                    <span :class="['flex size-10 shrink-0 items-center justify-center rounded-md', item.color]">
                        <component :is="item.icon" class="size-5" aria-hidden="true" />
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-sm">{{ item.label }}</span>
                        <span class="mt-1 block text-2xl font-semibold tabular-nums">{{ item.count }}</span>
                        <span class="mt-2 block text-xs text-muted-foreground">{{ item.detail }}</span>
                    </span>
                    <ArrowRight class="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </RouterLink>
            </section>

            <div class="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div class="min-w-0 space-y-7">
                    <section aria-labelledby="overview-tasks">
                        <header class="mb-2 flex items-center justify-between gap-3">
                            <h2 id="overview-tasks" class="flex items-center gap-2 text-base font-semibold">
                                优先待办
                                <span class="text-sm font-normal tabular-nums text-muted-foreground">
                                    {{ pendingTasks.length }}
                                </span>
                            </h2>
                            <Button variant="ghost" size="sm" as-child>
                                <RouterLink :to="paths.tasks">
                                    全部待办
                                    <ArrowRight class="size-3.5" aria-hidden="true" />
                                </RouterLink>
                            </Button>
                        </header>
                        <ul v-if="pendingTasks.length" class="border-y divide-y" data-queue="tasks">
                            <li v-for="item in pendingTasks.slice(0, 5)" :key="item.id">
                                <RouterLink
                                    :to="{ path: paths.tasks, query: { task: item.id } }"
                                    class="flex min-w-0 items-start gap-3 px-2.5 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                    :aria-label="`查看${item.title}`"
                                >
                                    <component
                                        :is="item.kind === '审批' ? ClipboardCheck : ListTodo"
                                        class="mt-1 size-4 shrink-0 text-primary"
                                        aria-hidden="true"
                                    />
                                    <span class="min-w-0 flex-1">
                                        <span class="block font-medium">
                                            {{ item.title }}
                                        </span>
                                        <span class="mt-1 block truncate text-xs text-muted-foreground">
                                            {{ item.subtitle }}
                                        </span>
                                    </span>
                                    <span class="flex shrink-0 flex-col items-end gap-1.5">
                                        <StateBadge :tone="isTaskOverdue(item) ? 'destructive' : 'warning'">
                                            {{ taskDisplayStatus(item) }}
                                        </StateBadge>
                                        <time
                                            :datetime="new Date(item.dueAt).toISOString()"
                                            class="text-xs tabular-nums text-muted-foreground"
                                        >
                                            {{ formatTime(item.dueAt) }}
                                        </time>
                                    </span>
                                </RouterLink>
                            </li>
                        </ul>
                        <Empty v-else class="min-h-40 border-y rounded-none">
                            <EmptyHeader>
                                <EmptyMedia variant="icon"><ListTodo /></EmptyMedia>
                                <EmptyTitle class="text-sm">暂无未完成待办</EmptyTitle>
                            </EmptyHeader>
                        </Empty>
                    </section>

                    <section aria-labelledby="overview-approvals">
                        <header class="mb-2 flex items-center justify-between gap-3">
                            <h2 id="overview-approvals" class="flex items-center gap-2 text-base font-semibold">
                                待审批
                                <span class="text-sm font-normal tabular-nums text-muted-foreground">
                                    {{ pendingApprovals.length }}
                                </span>
                            </h2>
                            <Button variant="ghost" size="sm" as-child>
                                <RouterLink :to="paths.approvals">
                                    全部申请
                                    <ArrowRight class="size-3.5" aria-hidden="true" />
                                </RouterLink>
                            </Button>
                        </header>
                        <ul v-if="pendingApprovals.length" class="border-y divide-y" data-queue="approvals">
                            <li v-for="item in pendingApprovals.slice(0, 4)" :key="item.id">
                                <RouterLink
                                    :to="{ path: paths.approvals, query: { approval: item.id } }"
                                    class="flex min-w-0 items-start gap-3 px-2.5 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                    :aria-label="`查看${item.applicant}的${item.kind}`"
                                >
                                    <ClipboardCheck class="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                                    <span class="min-w-0 flex-1">
                                        <span class="block font-medium">
                                            {{ item.kind }}
                                            <span class="font-normal text-muted-foreground">
                                                · {{ item.applicant }}
                                            </span>
                                        </span>
                                        <span class="mt-1 block truncate text-xs text-muted-foreground">
                                            {{ resourceName(item.resourceId) }}
                                        </span>
                                    </span>
                                    <span class="flex shrink-0 flex-col items-end gap-1.5">
                                        <span class="tabular-nums">{{ item.quantity }} {{ item.unit }}</span>
                                        <time
                                            :datetime="new Date(item.createdAt).toISOString()"
                                            class="text-xs tabular-nums text-muted-foreground"
                                        >
                                            {{ formatTime(item.createdAt) }}
                                        </time>
                                    </span>
                                </RouterLink>
                            </li>
                        </ul>
                        <Empty v-else class="min-h-40 border-y rounded-none">
                            <EmptyHeader>
                                <EmptyMedia variant="icon"><ClipboardCheck /></EmptyMedia>
                                <EmptyTitle class="text-sm">暂无待审批申请</EmptyTitle>
                            </EmptyHeader>
                        </Empty>
                    </section>
                </div>

                <div class="min-w-0 space-y-7">
                    <section aria-labelledby="overview-exceptions">
                        <header class="mb-2 flex items-center justify-between gap-3">
                            <h2 id="overview-exceptions" class="flex items-center gap-2 text-base font-semibold">
                                异常与提醒
                                <span class="text-sm font-normal tabular-nums text-muted-foreground">
                                    {{ unresolved.length }}
                                </span>
                            </h2>
                            <Button variant="ghost" size="sm" as-child>
                                <RouterLink :to="paths.exceptions">
                                    全部提醒
                                    <ArrowRight class="size-3.5" aria-hidden="true" />
                                </RouterLink>
                            </Button>
                        </header>
                        <ul v-if="unresolved.length" class="border-y divide-y" data-queue="exceptions">
                            <li v-for="item in unresolved.slice(0, 4)" :key="item.id">
                                <RouterLink
                                    :to="{ path: paths.exceptions, query: { exception: item.id } }"
                                    class="flex min-w-0 items-start gap-3 px-2.5 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                    :aria-label="`查看${item.title}`"
                                >
                                    <Bell
                                        class="mt-1 size-4 shrink-0"
                                        :style="{ color: `var(--${exceptionTone(item)}-soft-foreground)` }"
                                        aria-hidden="true"
                                    />
                                    <span class="min-w-0 flex-1">
                                        <span class="block font-medium">
                                            {{ item.title }}
                                        </span>
                                        <span class="mt-1 block truncate text-xs text-muted-foreground">
                                            {{ resourceName(item.resourceId) }}
                                        </span>
                                    </span>
                                    <StateBadge class="mt-0.5 shrink-0" :tone="exceptionTone(item)">
                                        {{ item.severity }}
                                    </StateBadge>
                                </RouterLink>
                            </li>
                        </ul>
                        <Empty v-else class="min-h-40 border-y rounded-none">
                            <EmptyHeader>
                                <EmptyMedia variant="icon"><Bell /></EmptyMedia>
                                <EmptyTitle class="text-sm">暂无未处理的异常与提醒</EmptyTitle>
                            </EmptyHeader>
                        </Empty>
                    </section>

                    <section aria-labelledby="overview-recent">
                        <h2 id="overview-recent" class="mb-3 text-base font-semibold">最近访问</h2>
                        <ul v-if="recentResources.length" class="border-y divide-y" data-queue="resources">
                            <li v-for="item in recentResources" :key="item.resource.id">
                                <button
                                    class="flex w-full min-w-0 items-start gap-3 px-2.5 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                    :aria-label="`查看${item.resource.name}`"
                                    @click="preview = item.resource"
                                >
                                    <component
                                        :is="resourceIcon(item.resource)"
                                        class="mt-1 size-4 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <span class="min-w-0 flex-1">
                                        <span class="block font-medium">
                                            {{ item.resource.name }}
                                        </span>
                                        <span class="mt-1 block text-xs text-muted-foreground">
                                            {{ item.resource.kind }} · {{ formatTime(item.visitedAt) }}
                                        </span>
                                    </span>
                                    <StateBadge class="mt-0.5 shrink-0" :tone="stateTone(item.resource.status)">
                                        {{ item.resource.status }}
                                    </StateBadge>
                                </button>
                            </li>
                        </ul>
                        <Empty v-else class="min-h-40 border-y rounded-none">
                            <EmptyHeader>
                                <EmptyMedia variant="icon"><Package /></EmptyMedia>
                                <EmptyTitle class="text-sm">暂无最近访问的资源</EmptyTitle>
                            </EmptyHeader>
                        </Empty>
                    </section>
                </div>
            </div>
        </div>
        <ResourceDialog v-model="preview" />
    </main>
</template>
