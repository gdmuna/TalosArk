<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { refDebounced } from '@vueuse/core';
import { Archive, Eye, FlaskConical, Shapes, Tag, CalendarDays, Pencil, Boxes } from '@lucide/vue';
import type { Material, MaterialQuery } from '@talos-ark/contracts/material';
import type { SortingState, PaginationState } from '@tanstack/vue-table';
import {
    useMaterialRead,
    useMaterialStore,
    materialBranches,
    branchPresentation,
    MaterialEditor,
    MaterialInspector,
    materialDate,
} from '@/module/material';
import { DataTable, type DataTableColumn, type DataTableFilter, type DataTableAction } from '@/component/data-table';
import { Badge } from '@/ui/badge';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import { useQueryCommand } from '@/platform/navigation';
import { useResourceQuery } from '../resource/useResourceQuery';

const route = useRoute(),
    router = useRouter();
const store = useMaterialStore();
const query = useResourceQuery();
const search = refDebounced(query, 200);
const filters = ref<Record<string, string[]>>({ status: ['active'] });
const sorting = ref<SortingState>([{ id: 'updatedAt', desc: true }]);
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const selectedId = ref(''),
    editing = ref<Material>(),
    editorOpen = ref(false);
const request = computed<MaterialQuery>(() => ({
    page: pagination.value.pageIndex + 1,
    pageSize: pagination.value.pageSize,
    q: search.value,
    branch: filters.value.branch?.length ? (filters.value.branch as MaterialQuery['branch']) : undefined,
    typeId: filters.value.type?.length ? filters.value.type : undefined,
    state: filters.value.status?.length === 1 ? (filters.value.status[0] as 'active' | 'archived') : 'all',
    sort: sorting.value.length
        ? sorting.value.map((item) => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',')
        : 'updatedAt:desc',
}));
const { data, loading, error, reload } = useMaterialRead(
    (context, signal) => context.source.list(context.scope, request.value, signal),
    [request]
);
const total = ref(0);
watch(data, (value) => {
    if (!value) return;
    total.value = value.total;
    store.capabilities = value.capabilities;
    if (pagination.value.pageIndex !== value.page - 1)
        pagination.value = { ...pagination.value, pageIndex: value.page - 1 };
});
watch(
    () => store.scope,
    () => {
        total.value = 0;
        pagination.value = { ...pagination.value, pageIndex: 0 };
        selectedId.value = '';
    }
);
const types = useMaterialRead((context, signal) => context.source.types(context.scope, signal));
watch(types.data, (value) => {
    if (value) store.types = value.items;
});
const rows = computed(() => data.value?.items ?? []);
const columns: DataTableColumn<Material>[] = [
    { id: 'name', label: '材料', icon: FlaskConical, size: 280, fill: true, value: (row) => row.name },
    { id: 'branch', label: '业务分支', icon: Shapes, size: 130, value: (row) => branchPresentation(row.branch).label },
    { id: 'type', label: '材料分类', icon: Tag, size: 140, value: (row) => row.type.name },
    { id: 'quantityUnit', label: '计量单位', size: 100, value: (row) => row.quantityUnit },
    {
        id: 'instanceCount',
        label: '登记实例',
        icon: Boxes,
        size: 100,
        align: 'right',
        sortable: false,
        value: (row) => row.instanceCount,
    },
    { id: 'status', label: '状态', size: 100, value: (row) => (row.archivedAt ? '已归档' : '有效') },
    { id: 'updatedAt', label: '更新时间', icon: CalendarDays, size: 185, value: (row) => materialDate(row.updatedAt) },
];
const filterFields = computed<DataTableFilter<Material>[]>(() => [
    {
        id: 'branch',
        label: '业务分支',
        mode: 'options',
        value: (row) => row.branch,
        options: materialBranches.map((item) => ({ value: item.id, label: item.label })),
    },
    {
        id: 'type',
        label: '材料分类',
        mode: 'options',
        value: (row) => row.typeId,
        options: store.types.map((item) => ({
            value: item.id,
            label: item.name + (item.archivedAt ? '（已归档）' : ''),
        })),
    },
    {
        id: 'status',
        label: '状态',
        mode: 'options',
        value: (row) => (row.archivedAt ? 'archived' : 'active'),
        options: [
            { value: 'active', label: '有效' },
            { value: 'archived', label: '已归档' },
        ],
    },
]);
function detail(item: Material) {
    return router.push(`/main/material/detail/${encodeURIComponent(item.id)}`);
}
function edit(item: Material) {
    editing.value = item;
    editorOpen.value = true;
}
const actions = computed<DataTableAction<Material>[]>(() => [
    {
        id: 'detail',
        label: '详情',
        icon: Eye,
        primary: true,
        run: (row) => {
            void detail(row);
        },
    },
    {
        id: 'edit',
        label: '编辑',
        icon: Pencil,
        disabled: (row) => !data.value?.capabilities.update || !!row.archivedAt || store.busy,
        run: edit,
    },
    {
        id: 'archive',
        label: '归档 / 恢复',
        icon: Archive,
        disabled: (row) =>
            !data.value?.capabilities.archive || store.busy || (!!row.archivedAt && !!row.type.archivedAt),
        run: async (row) => {
            await store.archive(row);
        },
    },
]);
watch(
    () => route.query.branch,
    (value) => {
        filters.value = {
            ...filters.value,
            branch: materialBranches.some((branch) => branch.id === value) ? [String(value)] : [],
        };
    },
    { immediate: true }
);
useQueryCommand('resource', (id) => {
    selectedId.value = id;
});
watch(
    () => route.query.state,
    (value) => {
        filters.value = {
            ...filters.value,
            status: value === 'all' ? [] : [value === 'archived' ? 'archived' : 'active'],
        };
    },
    { immediate: true }
);
</script>

<template>
    <main aria-label="材料列表" class="w-full min-w-0 px-4 pb-6 lg:px-6">
        <div class="mx-auto w-fit min-w-0 max-w-full space-y-4">
            <div
                v-if="error"
                role="alert"
                class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
            >
                <p class="text-sm text-destructive">{{ error }}</p>
                <Button variant="outline" @click="reload">重新加载</Button>
            </div>
            <p v-if="store.error" role="alert" class="text-sm text-destructive">{{ store.error }}</p>
            <p v-if="types.error.value" role="alert" class="text-sm text-destructive">
                分类加载失败
                <Button variant="link" size="sm" @click="types.reload">重试</Button>
            </p>
            <DataTable
                v-model:query="query"
                v-model:filters="filters"
                v-model:sorting="sorting"
                v-model:pagination="pagination"
                :server-total="total"
                :data="rows"
                :columns="columns"
                :filter-fields="filterFields"
                :actions="actions"
                :busy="loading"
                :preview="
                    (row) => {
                        selectedId = row.id;
                    }
                "
                :active-id="selectedId"
                search-label="搜索材料、厂家、别名或外部标识"
                :empty-text="error ? '材料加载失败' : '暂无符合条件的材料'"
            >
                <template #cell-name="{ row }">
                    <button
                        class="group flex w-full items-start gap-3 text-left after:absolute after:inset-0"
                        :aria-label="`预览${row.name}`"
                        @click="selectedId = row.id"
                    >
                        <component
                            :is="branchPresentation(row.branch).icon"
                            class="mt-0.5 size-5 shrink-0 text-primary"
                        />
                        <span class="min-w-0">
                            <span class="block font-medium group-hover:underline group-focus-visible:underline">
                                {{ row.name }}
                            </span>
                            <span
                                v-if="row.code || row.catalogNumber"
                                class="mt-1 block break-all text-xs text-muted-foreground"
                            >
                                {{ [row.code, row.catalogNumber].filter(Boolean).join(' · ') }}
                            </span>
                        </span>
                    </button>
                </template>
                <template #cell-branch="{ row }">
                    <Badge
                        variant="outline"
                        class="material-branch-badge whitespace-normal rounded-sm font-normal"
                        :style="{ '--material-branch-color': branchPresentation(row.branch).color }"
                    >
                        {{ branchPresentation(row.branch).label }}
                    </Badge>
                </template>
                <template #cell-status="{ row }">
                    <StateBadge :tone="row.archivedAt ? 'neutral' : 'success'">
                        {{ row.archivedAt ? '已归档' : '有效' }}
                    </StateBadge>
                </template>
            </DataTable>
        </div>
        <MaterialEditor v-model:open="editorOpen" :material="editing" />
        <MaterialInspector v-model:id="selectedId" />
    </main>
</template>
<style scoped>
.material-branch-badge {
    background-color: color-mix(in oklch, var(--material-branch-color) 14%, var(--surface-tint-base));
    border-color: color-mix(in oklch, var(--material-branch-color) 25%, var(--surface-tint-base));
    color: oklch(from var(--material-branch-color) 0.44 c h);
}
</style>
