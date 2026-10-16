<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRight, Folders, UsersRound, Mail, ShieldCheck } from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { managementPath } from '@/router/management-navigation';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementEmpty from './component/ManagementEmpty.vue';

const workspace = useWorkspaceStore();
const rows = computed(() =>
    workspace.workspaces
        .filter((item) => item.organizationId === workspace.organization?.id)
        .map((item) => ({ id: item.id, name: item.name, description: item.description }))
);
const metrics = computed(() => [
    { label: '可访问工作区', value: rows.value.length, icon: Folders, path: 'workspace' },
    { label: '组织成员', value: '未获取', icon: UsersRound, path: 'member' },
    { label: '待接受邀请', value: '未获取', icon: Mail, path: 'member' },
    { label: '治理风险', value: '未获取', icon: ShieldCheck, path: 'resource-grant' },
]);
const columns: DataTableColumn<(typeof rows.value)[number]>[] = [
    { id: 'name', label: '工作区', size: 240, icon: Folders, value: (row) => row.name },
    { id: 'description', label: '说明', size: 240, maxSize: 1200, fill: true, value: (row) => row.description || '—' },
    { id: 'owner', label: '负责人', size: 120, value: () => '未获取' },
    { id: 'state', label: '状态', size: 100, value: () => '未获取' },
];
</script>

<template>
    <ManagementPage title="概览">
        <div class="flex flex-wrap gap-3">
            <RouterLink
                v-for="metric in metrics"
                :key="metric.label"
                :to="`${managementPath}/${metric.path}`"
                class="group flex min-h-24 w-60 max-w-full items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <component :is="metric.icon" class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                    <div class="truncate text-muted-foreground">{{ metric.label }}</div>
                    <div
                        class="mt-1 font-semibold tabular-nums"
                        :class="typeof metric.value === 'number' ? 'text-xl' : 'text-sm text-muted-foreground'"
                    >
                        {{ metric.value }}
                    </div>
                </div>
                <ArrowRight class="size-4 text-muted-foreground" aria-hidden="true" />
            </RouterLink>
        </div>
        <div
            class="grid min-w-0 gap-6 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            data-slot="management-overview-columns"
        >
            <div class="min-w-0 space-y-6">
                <ManagementSection title="工作区概况" class="min-w-0">
                    <template #actions>
                        <RouterLink
                            :to="`${managementPath}/workspace`"
                            class="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                            全部工作区
                            <ArrowRight class="size-4" aria-hidden="true" />
                        </RouterLink>
                    </template>
                    <DataTable
                        :data="rows"
                        :columns="columns"
                        search-label="搜索工作区"
                        empty-text="工作区数据尚未加载"
                    />
                </ManagementSection>
                <ManagementSection title="最近审计">
                    <template #actions>
                        <RouterLink :to="`${managementPath}/audit-log`" class="text-primary hover:underline">
                            查看日志
                        </RouterLink>
                    </template>
                    <ManagementEmpty text="审计记录尚未加载" compact />
                </ManagementSection>
            </div>
            <aside class="min-w-0 space-y-6" aria-label="成员与治理概况">
                <ManagementSection title="成员与邀请">
                    <template #actions>
                        <RouterLink :to="`${managementPath}/member`" class="text-primary hover:underline">
                            查看成员
                        </RouterLink>
                    </template>
                    <ManagementEmpty text="成员与邀请概况尚未获取" compact />
                </ManagementSection>
                <ManagementSection title="授权待处理">
                    <template #actions>
                        <RouterLink :to="`${managementPath}/resource-grant`" class="text-primary hover:underline">
                            资源授权
                        </RouterLink>
                    </template>
                    <ManagementEmpty text="授权请求尚未加载" compact />
                </ManagementSection>
                <ManagementSection title="集成健康">
                    <template #actions>
                        <RouterLink :to="`${managementPath}/integration`" class="text-primary hover:underline">
                            查看集成
                        </RouterLink>
                    </template>
                    <ManagementEmpty text="集成状态尚未加载" compact />
                </ManagementSection>
            </aside>
        </div>
    </ManagementPage>
</template>
