<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { refDebounced } from '@vueuse/core';
import { Building2, Hash, MapPin, Folders, Network, CircleDot, Eye, ExternalLink, RotateCw, Search } from '@lucide/vue';
import {
    useFacilityDataSource,
    useFacilityRead,
    assertFacilityPage,
    type FacilitySummary,
    type FacilityQuery,
} from '@/module/facility';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { SelectField } from '@/component/select-field';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/dialog';
import { DataSyncNotice } from '@/component/data-sync';
import { Input } from '@/ui/input';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/ui/empty';
import ManagementPage from './component/ManagementPage.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import FacilityInspector from './facility/FacilityInspector.vue';
import Pagination from './facility/Pagination.vue';
import ReadFeedback from './facility/ReadFeedback.vue';
import FacilityFormDialog from './facility/FacilityFormDialog.vue';
import { facilityPath, governancePath, useFacilityContext } from './facility/context';
import { useManagementView } from './useManagementView';
import { useWorkspaceStore } from '@/module/workspace';

const route = useRoute(),
    router = useRouter(),
    source = useFacilityDataSource(),
    workspace = useWorkspaceStore();
const { scope, organization, invalid, key: contextKey, options, organizationId, update } = useFacilityContext();
const views = [
    { value: 'list', label: '设施列表' },
    { value: 'topology', label: '设施拓扑' },
];
const view = useManagementView(views);
const search = ref(typeof route.query.q === 'string' ? route.query.q : '');
const debounced = refDebounced(search, 200);
watch(
    () => route.query.q,
    (value) => {
        search.value = typeof value === 'string' ? value : '';
    }
);
watch(debounced, (value) => {
    if (route.path === facilityPath && value === search.value && value !== (route.query.q ?? ''))
        void update({ q: value || undefined });
});
const query = computed<FacilityQuery>(() => ({
    q: typeof route.query.q === 'string' ? route.query.q : undefined,
    state: ['active', 'archived', 'all'].includes(String(route.query.state))
        ? (String(route.query.state) as FacilityQuery['state'])
        : undefined,
    page: Number.isSafeInteger(Number(route.query.page)) && Number(route.query.page) > 0 ? Number(route.query.page) : 1,
    pageSize: [10, 20, 50, 100].includes(Number(route.query.pageSize)) ? Number(route.query.pageSize) : 10,
}));
const state = computed({
    get: () => query.value.state ?? 'all',
    set: (value: string) => {
        void update({ state: value === 'all' ? undefined : value });
    },
});
const key = computed(() =>
    source && contextKey.value && route.path === facilityPath ? JSON.stringify([contextKey.value, query.value]) : ''
);
const { data, loading, error, refresh } = useFacilityRead(key, async (signal) => {
    if (!source) return;
    const selectedScope = scope.value,
        request = query.value;
    const result = await source.list(selectedScope, request, signal);
    assertFacilityPage(selectedScope, request, result);
    return result;
});
const governanceKey = computed(() => (source && contextKey.value ? contextKey.value : ''));
const {
    data: governance,
    loading: governanceLoading,
    busy: initializeBusy,
    error: governanceError,
    syncError: initializeSyncError,
    pendingSync: initializePendingSync,
    refresh: refreshGovernance,
    write: writeGovernance,
} = useFacilityRead(governanceKey, (signal) =>
    source ? source.governance(scope.value, signal) : Promise.reject(new Error('设施来源不可用'))
);
const createOpen = ref(false);
const initializeOpen = ref(false);
watch(
    contextKey,
    () => {
        createOpen.value = false;
        initializeOpen.value = false;
    },
    { flush: 'sync' }
);
async function initialize() {
    if (!source || !governance.value?.canInitialize) return;
    const currentScope = scope.value;
    if (await writeGovernance((signal) => source.initialize(currentScope, signal))) {
        initializeOpen.value = false;
        await refresh();
    }
}
const createScope = computed(() => ({ ...scope.value, workspaceId: workspace.activeId || undefined }));
const previewId = ref<string | null>(null),
    previewOpen = ref(false);
watch(
    key,
    () => {
        previewId.value = null;
        previewOpen.value = false;
    },
    { flush: 'sync' }
);
watch(data, (value) => {
    if (!value?.items.some((item) => item.id === previewId.value)) previewOpen.value = false;
});
function preview(row: FacilitySummary) {
    previewId.value = row.id;
    previewOpen.value = true;
}
function detail(id: string) {
    previewOpen.value = false;
    void router.push({
        path: `${facilityPath}/${encodeURIComponent(id)}`,
        query: { organization: scope.value.organizationId },
    });
}
const columns: DataTableColumn<FacilitySummary>[] = [
    { id: 'name', label: '设施', size: 260, fill: true, icon: Building2, sortable: false, value: (row) => row.name },
    { id: 'code', label: '编号', size: 150, icon: Hash, sortable: false, value: (row) => row.code },
    {
        id: 'location',
        label: '位置',
        size: 220,
        icon: MapPin,
        sortable: false,
        value: (row) => row.location ?? '未提供',
    },
    {
        id: 'workspace',
        label: '管理工作区',
        size: 190,
        icon: Folders,
        sortable: false,
        value: (row) =>
            workspace.workspaces.find((item) => item.id === row.managementWorkspaceId)?.name ??
            row.managementWorkspaceId,
    },
    {
        id: 'state',
        label: '状态',
        size: 110,
        icon: CircleDot,
        sortable: false,
        value: (row) => (row.archivedAt ? '已归档' : row.disabledAt ? '已停用' : '正常'),
    },
];
</script>

<template>
    <ManagementPage
        title="设施"
        :layout="view === 'list' ? 'table' : 'tool'"
        :context="organization?.name ?? '组织不可用'"
    >
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="设施视图" /></template>
        <template #actions>
            <SelectField v-model="organizationId" :options="options" label="组织" hide-title class="w-56 max-w-full" />
            <Button v-if="governance?.canCreate && governance.canGovern" @click="createOpen = true">登记设施</Button>
            <Button
                v-if="governance?.canInitialize"
                variant="outline"
                :disabled="initializeBusy || governanceLoading || initializePendingSync"
                @click="initializeOpen = true"
            >
                初始化设施权限
            </Button>
            <Button v-if="source" variant="outline" :disabled="loading || !key" @click="refresh">
                <RotateCw aria-hidden="true" />
                刷新
            </Button>
        </template>
        <p v-if="invalid" role="alert" class="text-sm text-destructive">{{ invalid }}</p>
        <Empty v-else-if="!source" class="min-h-72 border-0">
            <EmptyHeader>
                <EmptyMedia variant="icon"><Building2 aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>设施查询暂不可用</EmptyTitle>
                <EmptyDescription>设施管理服务尚未开放，组织与工作区资料仍可查看。</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" as-child>
                <RouterLink :to="{ path: '/main/management/workspace', query: { organization: scope.organizationId } }">
                    查看工作区
                </RouterLink>
            </Button>
        </Empty>
        <template v-else>
            <ReadFeedback :error="governanceError" :loading="governanceLoading" @retry="refreshGovernance" />
            <DataSyncNotice
                scope="设施权限"
                :error="initializeSyncError"
                :pending="initializePendingSync"
                :busy="initializeBusy || governanceLoading"
                @retry="refreshGovernance"
            />
            <SelectField
                v-model="state"
                label="设施状态"
                hide-title
                class="w-40"
                :options="[
                    { value: 'all', label: '全部状态' },
                    { value: 'active', label: '未归档' },
                    { value: 'archived', label: '已归档' },
                ]"
            />
            <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
            <DataTable
                v-if="view === 'list'"
                v-model:query="search"
                :data="data?.items ?? []"
                :columns="columns"
                :server-total="data?.total ?? 0"
                :pagination="{ pageIndex: 0, pageSize: 100 }"
                :filtering="false"
                :busy="loading"
                :preview="preview"
                :active-id="previewId"
                :actions="[
                    { id: 'detail', label: '详情', icon: ExternalLink, primary: true, run: (row) => detail(row.id) },
                    { id: 'preview', label: '预览', icon: Eye, run: preview },
                ]"
                search-label="搜索设施名称、编号或位置"
                :empty-text="loading ? '正在读取设施' : error ? '设施暂不可用' : '没有符合条件的设施'"
            >
                <template #cell-name="{ row }">
                    <button
                        class="group flex w-full items-start gap-3 text-left after:absolute after:inset-0"
                        :aria-label="`预览${row.name}`"
                        @click="preview(row)"
                    >
                        <Building2 class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                        <span class="min-w-0">
                            <span
                                class="block break-words font-medium group-hover:underline group-focus-visible:underline"
                            >
                                {{ row.name }}
                            </span>
                            <span v-if="row.description" class="mt-1 block break-words text-xs text-muted-foreground">
                                {{ row.description }}
                            </span>
                        </span>
                    </button>
                </template>
                <template #cell-state="{ row }">
                    <StateBadge :tone="row.archivedAt ? 'neutral' : row.disabledAt ? 'warning' : 'success'">
                        {{ row.archivedAt ? '已归档' : row.disabledAt ? '已停用' : '正常' }}
                    </StateBadge>
                </template>
                <template #footer>
                    <Pagination
                        :page="query.page"
                        :page-size="query.pageSize"
                        :total="data?.total"
                        :loading="loading"
                        :error="!!error"
                        @page="update({ page: String($event) })"
                        @size="update({ pageSize: $event })"
                    />
                </template>
            </DataTable>
            <template v-else>
                <div class="relative ml-auto w-72 max-w-full">
                    <Search
                        class="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Input
                        v-model="search"
                        class="pl-9"
                        aria-label="搜索设施名称、编号或位置"
                        placeholder="搜索设施名称、编号或位置"
                    />
                </div>
                <p class="text-sm text-muted-foreground">{{ organization?.name }} · 本页设施的管理关系与存储拓扑</p>
                <div v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取设施</div>
                <p v-else-if="data && !data.items.length" class="py-12 text-center text-sm text-muted-foreground">
                    没有符合条件的设施
                </p>
                <ul class="divide-y border-y">
                    <li
                        v-for="item in data?.items ?? []"
                        :key="item.id"
                        class="flex flex-wrap items-start justify-between gap-4 py-5"
                    >
                        <div class="flex min-w-0 flex-1 items-start gap-3">
                            <Building2 class="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                            <div class="min-w-0 space-y-2">
                                <Button
                                    variant="link"
                                    class="h-auto max-w-full whitespace-normal p-0 text-left"
                                    @click="detail(item.id)"
                                >
                                    {{ item.name }}
                                </Button>
                                <p class="break-words text-sm text-muted-foreground">
                                    {{ item.code }} · {{ item.location ?? '位置未提供' }}
                                </p>
                                <p class="break-words text-sm">
                                    管理工作区：{{
                                        workspace.workspaces.find((entry) => entry.id === item.managementWorkspaceId)
                                            ?.name ?? item.managementWorkspaceId
                                    }}
                                </p>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-3 text-sm">
                            <Button variant="outline" size="sm" as-child>
                                <RouterLink
                                    :to="{
                                        path: governancePath,
                                        query: { organization: scope.organizationId, facility: item.id },
                                    }"
                                >
                                    <Network aria-hidden="true" />
                                    查看结构
                                </RouterLink>
                            </Button>
                        </div>
                    </li>
                </ul>
                <Pagination
                    :page="query.page"
                    :page-size="query.pageSize"
                    :total="data?.total"
                    :loading="loading"
                    :error="!!error"
                    @page="update({ page: String($event) })"
                    @size="update({ pageSize: $event })"
                />
            </template>
        </template>
    </ManagementPage>
    <FacilityInspector
        :id="previewId"
        v-model:open="previewOpen"
        :scope="scope"
        :context-key="contextKey"
        :organization-name="organization?.name"
        @detail="detail"
    />
    <FacilityFormDialog v-model:open="createOpen" :scope="createScope" @saved="refresh" />
    <Dialog v-model:open="initializeOpen">
        <DialogContent>
            <DialogTitle>初始化现有组织的设施权限？</DialogTitle>
            <DialogDescription>此操作显式为当前组织补充首批设施权限，不创建设施，不修改库存。</DialogDescription>
            <p v-if="governanceError" role="alert" class="text-sm text-destructive">{{ governanceError }}</p>
            <div class="flex justify-end gap-2">
                <Button variant="outline" @click="initializeOpen = false">取消</Button>
                <Button :disabled="initializeBusy || governanceLoading || initializePendingSync" @click="initialize">
                    确认初始化
                </Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
