<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRight, Folders, UsersRound, Mail, ShieldCheck } from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { DataTable } from '@/component/data-table';
import { managementPath } from '@/router/management-navigation';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementEmpty from './component/ManagementEmpty.vue';
import { column } from './table';

const workspace = useWorkspaceStore();
const rows = computed(() =>
    workspace.workspaces
        .filter((item) => item.organizationId === workspace.organization?.id)
        .map((item) => ({ id: item.id, name: item.name, description: item.description }))
);
const metrics = computed(() => [
    { label: '工作区', value: rows.value.length, icon: Folders, path: 'workspace' },
    { label: '组织成员', value: '—', icon: UsersRound, path: 'member' },
    { label: '待接受邀请', value: '—', icon: Mail, path: 'member' },
    { label: '治理风险', value: '—', icon: ShieldCheck, path: 'resource-grant' },
]);
const columns = [
    column('name', '工作区', 260, Folders),
    column('description', '描述', 380),
    column('owner', '负责人', 160),
    column('state', '状态', 140),
];
</script>

<template>
    <ManagementPage title="概览">
        <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <RouterLink
                v-for="metric in metrics"
                :key="metric.label"
                :to="`${managementPath}/${metric.path}`"
                class="group flex min-w-0 items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <component :is="metric.icon" class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                    <div class="truncate text-muted-foreground">{{ metric.label }}</div>
                    <div class="mt-1 text-2xl font-semibold tabular-nums">{{ metric.value }}</div>
                </div>
                <ArrowRight class="size-4 text-muted-foreground" aria-hidden="true" />
            </RouterLink>
        </div>
        <ManagementSection title="工作区概况" class="w-full min-w-0">
            <template #actions>
                <RouterLink
                    :to="`${managementPath}/workspace`"
                    class="inline-flex items-center gap-1 text-primary hover:underline"
                >
                    全部工作区
                    <ArrowRight class="size-4" aria-hidden="true" />
                </RouterLink>
            </template>
            <DataTable :data="rows" :columns="columns" search-label="搜索工作区" empty-text="工作区数据尚未加载" />
        </ManagementSection>
        <div class="grid gap-6 xl:grid-cols-3">
            <ManagementSection title="最近审计">
                <template #actions>
                    <RouterLink :to="`${managementPath}/audit-log`" class="text-primary hover:underline">
                        查看日志
                    </RouterLink>
                </template>
                <ManagementEmpty text="审计记录尚未加载" />
            </ManagementSection>
            <ManagementSection title="授权待处理">
                <template #actions>
                    <RouterLink :to="`${managementPath}/resource-grant`" class="text-primary hover:underline">
                        资源授权
                    </RouterLink>
                </template>
                <ManagementEmpty text="授权请求尚未加载" />
            </ManagementSection>
            <ManagementSection title="集成健康">
                <template #actions>
                    <RouterLink :to="`${managementPath}/integration`" class="text-primary hover:underline">
                        查看集成
                    </RouterLink>
                </template>
                <ManagementEmpty text="集成状态尚未加载" />
            </ManagementSection>
        </div>
    </ManagementPage>
</template>
