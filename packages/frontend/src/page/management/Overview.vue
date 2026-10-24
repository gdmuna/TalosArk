<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ArrowRight, Building2, Folders, UsersRound, Mail, Plus, RotateCw } from '@lucide/vue';
import { useOrganizationRead } from '@/module/organization';
import { WorkspaceCreateDialog } from '@/module/workspace/ui';
import { HttpError } from '@/platform/http';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { SelectField } from '@/component/select-field';
import { DataSyncNotice } from '@/component/data-sync';
import { Button } from '@/ui/button';
import { formatDateTime } from '@/shared/util/date-time';
import { managementPath } from '@/router/management-navigation';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementEmpty from './component/ManagementEmpty.vue';
import OrganizationIdentity from './organization/OrganizationIdentity.vue';
import RecentAudit from './organization/RecentAudit.vue';
import { useOrganizationContext } from './organization/context';

const router = useRouter();
const { workspace, source, organizationId, organization, identity, key, profile, options } = useOrganizationContext();
const { data: organizationProfile } = profile;
const { error: profileError, loading: profileLoading, refresh: refreshProfile } = profile;
const summaryKey = computed(() => (source?.summary ? key.value : ''));
const summary = useOrganizationRead(summaryKey, async (signal) => {
    if (!source?.summary) return;
    const id = organizationId.value;
    const value = await source.summary(id, signal);
    if (
        value.organizationId !== id ||
        !Number.isFinite(Date.parse(value.measuredAt)) ||
        [value.activeMemberCount, value.pendingInvitationCount].some(
            (count) => count !== null && (!Number.isSafeInteger(count) || count < 0)
        )
    )
        throw new HttpError('组织摘要响应无效', 'protocol');
    return value;
});
const { data: totals, loading, error, refresh } = summary;
const createOpen = ref(false);
watch(
    key,
    () => {
        createOpen.value = false;
    },
    { flush: 'sync' }
);
const rows = computed(() =>
    workspace.workspaces.filter((item) => organization.value && item.organizationId === organizationId.value)
);
const link = (path: string, query: Record<string, string> = {}) => ({
    path: `${managementPath}/${path}`,
    query: { organization: organizationId.value, ...query },
});
const metrics = computed(() => [
    {
        label: '可访问工作区',
        value: rows.value.length,
        icon: Folders,
        to: link('workspace'),
        tone: 'bg-primary-soft text-primary-soft-foreground',
    },
    {
        label: '有效组织成员',
        value: totals.value?.activeMemberCount ?? (loading.value ? '加载中' : '暂不可用'),
        icon: UsersRound,
        to: link('member'),
        tone: 'bg-success-soft text-success-soft-foreground',
    },
    {
        label: '待接受邀请',
        value: totals.value?.pendingInvitationCount ?? (loading.value ? '加载中' : '暂不可用'),
        icon: Mail,
        to: link('member', { tab: 'invitations' }),
        tone: 'bg-warning-soft text-warning-soft-foreground',
    },
]);
type Row = (typeof rows.value)[number];
function openWorkspace(row: Row) {
    return router.push({
        path: `${managementPath}/workspace/${encodeURIComponent(row.id)}`,
        query: { organization: row.organizationId },
    });
}
const columns: DataTableColumn<(typeof rows.value)[number]>[] = [
    { id: 'name', label: '工作区', size: 260, maxSize: 1200, fill: true, icon: Folders, value: (row) => row.name },
    { id: 'description', label: '说明', size: 240, value: (row) => row.description || '—' },
];
</script>

<template>
    <ManagementPage title="概览" :context="organizationProfile?.name ?? organization?.name ?? '组织不可用'">
        <template #actions>
            <div class="w-60 max-w-full [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-value]]:min-w-0">
                <SelectField v-model="organizationId" label="当前管理组织" :options="options" />
            </div>
            <Button v-if="organization" variant="outline" as-child>
                <RouterLink :to="link('organization-setting')">
                    <Building2 aria-hidden="true" />
                    组织设置
                </RouterLink>
            </Button>
        </template>
        <ManagementEmpty v-if="!organization" text="组织不存在或不在当前可访问范围内" />
        <template v-else>
            <OrganizationIdentity :id="organization.id" :name="organization.name" :profile="organizationProfile" />
            <div v-if="profileError" role="alert" class="flex flex-wrap items-center gap-2 text-sm text-destructive">
                <span>{{ profileError }}{{ organizationProfile ? '，当前保留上次读取结果。' : '' }}</span>
                <Button variant="outline" size="sm" :disabled="profileLoading" @click="refreshProfile">
                    重新加载资料
                </Button>
            </div>
            <div class="flex flex-wrap gap-3" data-slot="organization-metrics">
                <RouterLink
                    v-for="metric in metrics"
                    :key="metric.label"
                    :to="metric.to"
                    class="group flex min-h-24 w-60 max-w-full items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <span class="flex size-10 shrink-0 items-center justify-center rounded-md" :class="metric.tone">
                        <component :is="metric.icon" class="size-5" aria-hidden="true" />
                    </span>
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
                    <ManagementSection title="可访问工作区" class="min-w-0">
                        <template #actions>
                            <RouterLink
                                :to="link('workspace')"
                                class="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                                全部工作区
                                <ArrowRight class="size-4" aria-hidden="true" />
                            </RouterLink>
                        </template>
                        <DataSyncNotice
                            scope="工作区"
                            :error="workspace.syncError"
                            :pending="workspace.syncPending"
                            :busy="workspace.busy"
                            @retry="workspace.retrySync()"
                        />
                        <DataTable
                            :key="key"
                            :data="rows"
                            :columns="columns"
                            :actions="[
                                {
                                    id: 'detail',
                                    label: '详情',
                                    icon: Folders,
                                    primary: true,
                                    run: async (row) => {
                                        await openWorkspace(row);
                                    },
                                },
                            ]"
                            :min-rows="2"
                            :max-height="400"
                            search-label="搜索工作区"
                            empty-text="当前组织暂无可访问工作区"
                        >
                            <template #cell-name="{ row, preview }">
                                <button
                                    class="group flex w-full items-start gap-3 text-left after:absolute after:inset-0"
                                    :aria-label="`预览${row.name}`"
                                    @click="preview"
                                >
                                    <Folders class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                                    <span class="min-w-0">
                                        <span
                                            class="block break-words font-medium group-hover:underline group-focus-visible:underline"
                                        >
                                            {{ row.name }}
                                        </span>
                                        <span class="mt-1 block break-all font-mono text-xs text-muted-foreground">
                                            {{ row.id }}
                                        </span>
                                    </span>
                                </button>
                            </template>
                        </DataTable>
                        <Button
                            v-if="organization.canCreateWorkspace"
                            variant="outline"
                            :disabled="workspace.busy || workspace.switching || !!workspace.syncError"
                            @click="createOpen = true"
                        >
                            <Plus aria-hidden="true" />
                            新建工作区
                        </Button>
                    </ManagementSection>
                    <RecentAudit :organization-id="organizationId" :identity="identity" :context-key="key" />
                </div>
                <aside class="min-w-0 space-y-6" aria-label="成员与组织管理">
                    <ManagementSection title="成员与邀请">
                        <template #actions>
                            <Button
                                v-if="source?.summary"
                                variant="ghost"
                                size="icon-sm"
                                use-tooltip
                                tooltip="刷新成员摘要"
                                :disabled="loading || !key"
                                @click="refresh"
                            >
                                <RotateCw aria-hidden="true" />
                            </Button>
                        </template>
                        <p v-if="error" role="alert" class="text-sm text-destructive">
                            {{ error }}{{ totals ? '，当前保留上次读取结果。' : '' }}
                        </p>
                        <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在加载成员摘要</p>
                        <ManagementEmpty v-else-if="!source?.summary" text="组织成员统计服务尚未开放" compact />
                        <p v-if="totals" class="text-xs text-muted-foreground">
                            统计时间 {{ formatDateTime(Date.parse(totals.measuredAt)) }}
                        </p>
                        <div class="divide-y">
                            <RouterLink
                                :to="link('member')"
                                class="flex items-center gap-3 py-3 text-sm hover:text-primary"
                            >
                                <UsersRound class="size-4 shrink-0" aria-hidden="true" />
                                <span class="min-w-0 flex-1">查看组织成员</span>
                                <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
                            </RouterLink>
                            <RouterLink
                                :to="link('member', { tab: 'invitations' })"
                                class="flex items-center gap-3 py-3 text-sm hover:text-primary"
                            >
                                <Mail class="size-4 shrink-0" aria-hidden="true" />
                                <span class="min-w-0 flex-1">查看邀请</span>
                                <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
                            </RouterLink>
                        </div>
                    </ManagementSection>
                    <ManagementSection title="组织管理">
                        <RouterLink
                            :to="link('role')"
                            class="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                        >
                            角色与权限
                            <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
                        </RouterLink>
                        <RouterLink
                            :to="link('organization-setting')"
                            class="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                        >
                            组织设置
                            <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
                        </RouterLink>
                    </ManagementSection>
                </aside>
            </div>
            <WorkspaceCreateDialog v-model:open="createOpen" mode="workspace" :organization-id="organizationId" />
        </template>
    </ManagementPage>
</template>
