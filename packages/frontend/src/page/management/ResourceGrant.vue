<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router';
import { refDebounced } from '@vueuse/core';
import {
    Package,
    Shapes,
    UserRound,
    KeyRound,
    GitBranch,
    Calendar,
    CircleDot,
    Eye,
    ExternalLink,
    RotateCw,
    ChevronLeft,
    ChevronRight,
} from '@lucide/vue';
import {
    useResourceAccessDataSource,
    useResourceAccessRead,
    assertAccessScope,
    assertGrantScope,
    type ResourceGrant,
    type ResourceAccessQuery,
} from '@/module/resource-access';
import { HttpError } from '@/platform/http';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { SelectField } from '@/component/select-field';
import { Button } from '@/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/ui/empty';
import ManagementPage from './component/ManagementPage.vue';
import AccessScopeField from './resource-grant/AccessScopeField.vue';
import GrantInspector from './resource-grant/GrantInspector.vue';
import ReadFeedback from './resource-grant/ReadFeedback.vue';
import { resourceGrantPath, useAccessContext } from './resource-grant/context';
import { grantStates, grantValidity } from './resource-grant/presentation';

const route = useRoute(),
    router = useRouter(),
    source = useResourceAccessDataSource();
const {
    scope,
    key: contextKey,
    invalid,
    organization,
    organizationId,
    workspaceId,
    organizationOptions,
    workspaceOptions,
    update,
} = useAccessContext();
watch(
    [contextKey, () => route.query.organization],
    ([value]) => {
        if (value && route.path === resourceGrantPath && route.query.organization === undefined)
            void router.replace({
                query: { ...route.query, organization: scope.value.organizationId },
                hash: route.hash,
            });
    },
    { immediate: true }
);
const values = (value: LocationQueryValue | LocationQueryValue[] | undefined) =>
    (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === 'string' && !!item);
const search = ref(typeof route.query.q === 'string' ? route.query.q : '');
const debounced = refDebounced(search, 200);
const filters = ref<Record<string, string[]>>({});
watch(
    () => route.query,
    (query) => {
        search.value = typeof query.q === 'string' ? query.q : '';
        filters.value = { type: values(query.type), basis: values(query.basis), status: values(query.status) };
    },
    { immediate: true }
);
const page = computed(() =>
    Number.isSafeInteger(Number(route.query.page)) && Number(route.query.page) > 0 ? Number(route.query.page) : 1
);
const pageSize = computed({
    get: () => ([10, 20, 50, 100].includes(Number(route.query.pageSize)) ? String(route.query.pageSize) : '10'),
    set: (size: string) => {
        void update({ pageSize: size });
    },
});
const request = computed<ResourceAccessQuery>(() => ({
    q: typeof route.query.q === 'string' ? route.query.q : undefined,
    type: values(route.query.type),
    basis: values(route.query.basis),
    status: values(route.query.status),
    page: page.value,
    pageSize: Number(pageSize.value),
}));
watch(debounced, (value) => {
    if (route.path === resourceGrantPath && value === search.value && value !== (route.query.q ?? ''))
        void update({ q: value || undefined });
});
function setFilters(value: Record<string, string[]>) {
    filters.value = value;
    void update({
        type: value.type?.length ? value.type : undefined,
        basis: value.basis?.length ? value.basis : undefined,
        status: value.status?.length ? value.status : undefined,
    });
}
const key = computed(() =>
    source && contextKey.value && route.path === resourceGrantPath
        ? JSON.stringify([contextKey.value, request.value])
        : ''
);
const { data, loading, error, refresh } = useResourceAccessRead(key, async (signal) => {
    if (!source) return;
    const selectedScope = scope.value,
        query = request.value;
    const result = await source.list(selectedScope, query, signal);
    assertAccessScope(selectedScope, result.organizationId, result.workspaceId);
    result.items.forEach((grant) => assertGrantScope(selectedScope, grant));
    if (
        result.workspaceId !== selectedScope.workspaceId ||
        !Number.isFinite(Date.parse(result.measuredAt)) ||
        !Number.isSafeInteger(result.total) ||
        result.total < result.items.length ||
        result.items.length > query.pageSize ||
        result.page !== query.page ||
        result.pageSize !== query.pageSize
    )
        throw new HttpError('授权列表分页无效', 'protocol');
    return result;
});
const pageCount = computed(() =>
    data.value ? Math.max(1, Math.ceil(data.value.total / Number(pageSize.value))) : undefined
);
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
function preview(row: ResourceGrant) {
    previewId.value = row.id;
    previewOpen.value = true;
}
function detail(resourceId: string) {
    previewOpen.value = false;
    void router.push({
        path: `${resourceGrantPath}/${encodeURIComponent(resourceId)}`,
        query: {
            organization: scope.value.organizationId,
            workspace: scope.value.workspaceId,
        },
    });
}
const columns: DataTableColumn<ResourceGrant>[] = [
    {
        id: 'resource',
        label: '资源',
        size: 260,
        fill: true,
        icon: Package,
        sortable: false,
        value: (row) => row.resource.name,
    },
    {
        id: 'type',
        label: '资源类型',
        size: 120,
        icon: Shapes,
        sortable: false,
        value: (row) => row.resource.type.label,
    },
    {
        id: 'principal',
        label: '授权对象',
        size: 170,
        icon: UserRound,
        sortable: false,
        value: (row) => row.principal.name,
    },
    {
        id: 'permission',
        label: '权限',
        size: 160,
        icon: KeyRound,
        sortable: false,
        value: (row) => row.permissions.map((item) => item.label).join('、') || '未提供',
    },
    { id: 'basis', label: '授权来源', size: 160, icon: GitBranch, sortable: false, value: (row) => row.basis.label },
    {
        id: 'expiresAt',
        label: '有效期',
        size: 165,
        icon: Calendar,
        sortable: false,
        value: (row) => grantValidity(row.expiresAt),
    },
    {
        id: 'status',
        label: '状态',
        size: 100,
        icon: CircleDot,
        sortable: false,
        value: (row) => grantStates[row.status].label,
    },
];
const filterFields = computed<DataTableFilter<ResourceGrant>[]>(() => [
    {
        id: 'type',
        label: '资源类型',
        mode: 'options',
        options: data.value?.filters.type ?? [],
        value: (row) => row.resource.type.value,
    },
    {
        id: 'basis',
        label: '授权来源',
        mode: 'options',
        options: data.value?.filters.basis ?? [],
        value: (row) => row.basis.id,
    },
    {
        id: 'status',
        label: '状态',
        mode: 'options',
        options: data.value?.filters.status ?? [],
        value: (row) => row.status,
    },
]);
</script>
<template>
    <ManagementPage title="资源授权" layout="tool" :context="organization?.name ?? '组织不可用'">
        <template #actions>
            <AccessScopeField v-model="organizationId" :options="organizationOptions" label="组织" />
            <Button v-if="source" variant="outline" :disabled="!key || loading" @click="refresh">
                <RotateCw aria-hidden="true" />
                刷新
            </Button>
        </template>
        <p v-if="invalid" role="alert" class="text-sm text-destructive">{{ invalid }}</p>
        <Empty v-else-if="!source" class="min-h-72 border-0">
            <EmptyHeader>
                <EmptyMedia variant="icon"><KeyRound aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>资源授权暂不可用</EmptyTitle>
                <EmptyDescription>资源授权查询服务尚未开放，现有角色绑定仍在角色与成员页面管理。</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" as-child>
                <RouterLink :to="{ path: '/main/management/role', query: { organization: scope.organizationId } }">
                    查看角色与权限
                </RouterLink>
            </Button>
        </Empty>
        <template v-else>
            <div class="flex flex-wrap items-center justify-between gap-3">
                <AccessScopeField v-model="workspaceId" :options="workspaceOptions" label="授权范围" />
                <p v-if="data" class="text-xs text-muted-foreground">查询结果由当前授权范围限定</p>
            </div>
            <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
            <DataTable
                v-model:query="search"
                :filters="filters"
                :pagination="{ pageIndex: 0, pageSize: 100 }"
                :server-total="data?.total ?? 0"
                :data="data?.items ?? []"
                :columns="columns"
                :filter-fields="filterFields"
                :busy="loading"
                :preview="preview"
                :active-id="previewId"
                :actions="[
                    {
                        id: 'detail',
                        label: '详情',
                        icon: ExternalLink,
                        primary: true,
                        run: (row) => detail(row.resource.id),
                    },
                    { id: 'preview', label: '预览', icon: Eye, run: preview },
                ]"
                search-label="搜索资源、编号或授权对象"
                :empty-text="
                    loading ? '正在读取授权记录' : error ? '授权记录暂不可用' : '当前范围没有符合条件的授权记录'
                "
                @update:filters="setFilters"
            >
                <template #cell-resource="{ row }">
                    <button
                        class="group flex w-full items-start gap-3 text-left after:absolute after:inset-0"
                        :aria-label="`预览${row.resource.name}的授权`"
                        @click="preview(row)"
                    >
                        <Package class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                        <span class="min-w-0">
                            <span
                                class="block break-words font-medium group-hover:underline group-focus-visible:underline"
                            >
                                {{ row.resource.name }}
                            </span>
                            <span class="mt-1 block break-all text-xs text-muted-foreground">
                                {{ row.resource.code ?? row.resource.id }}
                            </span>
                        </span>
                    </button>
                </template>
                <template #cell-status="{ row }">
                    <StateBadge :tone="grantStates[row.status].tone">{{ grantStates[row.status].label }}</StateBadge>
                </template>
                <template #footer>
                    <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span role="status" class="text-muted-foreground">
                            {{ data ? `共 ${data.total} 项` : loading ? '正在读取' : '总量暂不可用' }}
                        </span>
                        <div class="flex flex-wrap items-center gap-3">
                            <span>每页</span>
                            <SelectField
                                v-model="pageSize"
                                hide-title
                                label="每页条数"
                                :options="
                                    [10, 20, 50, 100].map((size) => ({ value: String(size), label: `${size} 条` }))
                                "
                                class="min-w-24 h-8"
                            />
                            <span class="tabular-nums">
                                第 {{ page }} 页
                                <template v-if="pageCount">，共 {{ pageCount }} 页</template>
                            </span>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                use-tooltip
                                tooltip="上一页"
                                :disabled="loading || page <= 1"
                                @click="update({ page: String(page - 1) })"
                            >
                                <ChevronLeft aria-hidden="true" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                use-tooltip
                                tooltip="下一页"
                                :disabled="loading || !!error || !pageCount || page >= pageCount"
                                @click="update({ page: String(page + 1) })"
                            >
                                <ChevronRight aria-hidden="true" />
                            </Button>
                        </div>
                    </div>
                </template>
            </DataTable>
        </template>
    </ManagementPage>
    <GrantInspector
        :id="previewId"
        v-model:open="previewOpen"
        :scope="scope"
        :context-key="contextKey"
        @detail="detail"
    />
</template>
