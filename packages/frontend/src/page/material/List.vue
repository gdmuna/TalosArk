<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryCommand } from '@/platform/navigation';
import {
    ArrowUpRight,
    Boxes,
    CalendarDays,
    CircleCheck,
    Eye,
    FlaskConical,
    PackageSearch,
    Shapes,
    Tag,
} from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { stateTone, type Resource } from '@/module/workbench';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/component/data-table';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { StateBadge } from '@/component/state-badge';
import { ScrollSurface } from '@/component/scroll-surface';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import ResourceFactList from '../resource/ResourceFactList.vue';
import ResourceSection from '../resource/ResourceSection.vue';
import { useResourceQuery } from '../resource/useResourceQuery';
import { materialBranches, materialBranch, useMaterialSummary } from './useMaterialSummary';

const route = useRoute();
const router = useRouter();
const workspace = useWorkspaceStore();
const { workbench, materials, instancesByMaterial, distribution, unclassified } = useMaterialSummary();
const filters = ref<Record<string, string[]>>({});
const query = useResourceQuery();
const selectedId = ref<string | null>(null);
const selected = computed(() => materials.value.find((item) => item.id === selectedId.value));
const selectedInstances = computed(() => instancesByMaterial.value.get(selectedId.value ?? '') ?? []);
const open = computed({
    get: () => !!selected.value,
    set: (value) => {
        if (!value) selectedId.value = null;
    },
});
const columns: DataTableColumn<Resource>[] = [
    { id: 'name', label: '材料', icon: FlaskConical, size: 280, value: (row) => row.name },
    {
        id: 'branch',
        label: '业务分支',
        icon: Shapes,
        size: 130,
        value: (row) => materialBranch(row)?.label ?? '未分类',
    },
    { id: 'type', label: '材料类型', icon: Tag, size: 130, value: (row) => row.material?.type ?? '未加载' },
    {
        id: 'instances',
        label: '关联实例',
        icon: Boxes,
        size: 110,
        value: (row) => instancesByMaterial.value.get(row.id)?.length ?? 0,
    },
    { id: 'stock', label: '库存状态', icon: PackageSearch, size: 120, sortable: false, value: () => '—' },
    { id: 'status', label: '材料状态', icon: CircleCheck, size: 110, value: (row) => row.status },
    { id: 'updated', label: '更新时间', icon: CalendarDays, size: 180, sortable: false, value: () => '—' },
];
const filterFields = computed<DataTableFilter<Resource>[]>(() => [
    {
        id: 'branch',
        label: '业务分支',
        mode: 'options',
        value: (row) => row.material?.branch ?? 'unclassified',
        options: [
            ...distribution.value.map((branch) => ({ value: branch.id, label: branch.label, count: branch.count })),
            ...(unclassified.value ? [{ value: 'unclassified', label: '未分类', count: unclassified.value }] : []),
        ],
    },
    {
        id: 'type',
        label: '材料类型',
        mode: 'options',
        value: (row) => row.material?.type ?? '未加载',
        options: [...new Set(materials.value.map((item) => item.material?.type ?? '未加载'))].map((type) => ({
            value: type,
            label: type,
        })),
    },
    {
        id: 'status',
        label: '材料状态',
        mode: 'options',
        value: (row) => row.status,
        options: [...new Set(materials.value.map((item) => item.status))].map((status) => ({
            value: status,
            label: status,
        })),
    },
]);
watch(
    () => route.query.branch,
    (branch) => {
        filters.value = {
            ...filters.value,
            branch: materialBranches.some((item) => item.id === branch) ? [branch as string] : [],
        };
    },
    { immediate: true }
);
watch(
    () => workspace.activeId,
    () => {
        selectedId.value = null;
    }
);
useQueryCommand('resource', (id) => {
    selectedId.value = id;
});
function fullDetail(item: Resource) {
    router.push(`/main/material/detail/${encodeURIComponent(item.id)}`);
    selectedId.value = null;
}
</script>

<template>
    <main aria-label="材料列表" class="w-full min-w-0 px-5 pb-8 lg:px-6">
        <div class="mx-auto w-fit min-w-0 max-w-full">
            <SheetInspector v-model:open="open" :title="selected?.name ?? '材料详情'" description="材料与关联库存摘要">
                <template #main>
                    <DataTable
                        v-model:query="query"
                        v-model:filters="filters"
                        :data="materials"
                        :columns="columns"
                        :filter-fields="filterFields"
                        :active-id="selectedId"
                        :preview="
                            (row) => {
                                selectedId = row.id;
                            }
                        "
                        :busy="workbench.busy"
                        search-label="搜索材料名称、类型或 ID"
                        :search-text="
                            (row) =>
                                `${row.name} ${row.id} ${row.material?.type ?? ''} ${materialBranch(row)?.label ?? ''} ${row.description}`
                        "
                        empty-text="暂无符合条件的材料"
                        :actions="[
                            {
                                id: 'detail',
                                label: '详情',
                                icon: Eye,
                                primary: true,
                                run: fullDetail,
                            },
                            {
                                id: 'preview',
                                label: '预览',
                                icon: Eye,
                                run: (row) => {
                                    selectedId = row.id;
                                },
                            },
                        ]"
                    >
                        <template #cell-name="{ row }">
                            <button
                                class="group flex w-full items-start gap-3 text-left after:absolute after:inset-0"
                                :aria-label="`查看${row.name}`"
                                @click="selectedId = row.id"
                            >
                                <component
                                    :is="materialBranch(row)?.icon ?? FlaskConical"
                                    class="mt-0.5 size-5 shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <span class="min-w-0">
                                    <span class="block font-medium group-hover:underline group-focus-visible:underline">
                                        {{ row.name }}
                                    </span>
                                    <span class="mt-1 block font-mono text-xs text-muted-foreground">{{ row.id }}</span>
                                </span>
                            </button>
                        </template>
                        <template #cell-branch="{ row }">
                            <Badge
                                variant="outline"
                                class="material-branch-badge rounded-sm font-normal"
                                :style="{ '--material-branch-color': materialBranch(row)?.color }"
                            >
                                {{ materialBranch(row)?.label ?? '未分类' }}
                            </Badge>
                        </template>
                        <template #cell-stock>
                            <span class="text-muted-foreground" aria-label="库存统计未加载">—</span>
                        </template>
                        <template #cell-updated>
                            <span class="text-muted-foreground" aria-label="更新时间未加载">—</span>
                        </template>
                        <template #cell-status="{ row }">
                            <StateBadge :tone="stateTone(row.status)">{{ row.status }}</StateBadge>
                        </template>
                    </DataTable>
                </template>
                <template v-if="selected">
                    <ScrollSurface class="min-h-0 flex-1 scroll-smooth p-6">
                        <div class="space-y-6">
                            <div class="flex items-start gap-3 pr-7">
                                <div
                                    class="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground"
                                >
                                    <component
                                        :is="materialBranch(selected)?.icon ?? FlaskConical"
                                        class="size-6"
                                        aria-hidden="true"
                                    />
                                </div>
                                <div class="min-w-0 space-y-2">
                                    <h2 class="text-lg font-semibold">{{ selected.name }}</h2>
                                    <CopyableId :value="selected.id" label="材料 ID" />
                                    <StateBadge :tone="stateTone(selected.status)">{{ selected.status }}</StateBadge>
                                </div>
                            </div>
                            <ResourceSection title="基本信息">
                                <ResourceFactList
                                    :fields="[
                                        { label: '业务分支', value: materialBranch(selected)?.label },
                                        { label: '材料类型', value: selected.material?.type },
                                        { label: '工作区', value: workspace.current?.name },
                                        { label: '制造商' },
                                        { label: '目录编号' },
                                        { label: '计量单位' },
                                        { label: '说明', value: selected.description },
                                    ]"
                                />
                            </ResourceSection>
                            <ResourceSection
                                v-if="materialBranch(selected)"
                                :title="`${materialBranch(selected)?.label}属性`"
                            >
                                <ResourceFactList
                                    :fields="materialBranch(selected)?.fields.map((label) => ({ label })) ?? []"
                                />
                            </ResourceSection>
                            <ResourceSection title="关联库存实例">
                                <div v-if="selectedInstances.length" class="divide-y">
                                    <Button
                                        v-for="instance in selectedInstances"
                                        :key="instance.id"
                                        variant="ghost"
                                        class="h-auto w-full justify-start rounded-none px-0 py-3 text-left"
                                        @click="
                                            router.push(`/main/inventory/detail/${encodeURIComponent(instance.id)}`)
                                        "
                                    >
                                        <Boxes class="shrink-0" aria-hidden="true" />
                                        <span class="min-w-0 flex-1 whitespace-normal">
                                            <span class="block">{{ instance.name }}</span>
                                            <span class="mt-1 block font-mono text-xs text-muted-foreground">
                                                {{ instance.id }}
                                            </span>
                                        </span>
                                        <StateBadge :tone="stateTone(instance.status)">
                                            {{ instance.status }}
                                        </StateBadge>
                                        <ArrowUpRight class="shrink-0" aria-hidden="true" />
                                    </Button>
                                </div>
                                <p v-else class="py-4 text-sm text-muted-foreground">暂无关联的库存实例摘要</p>
                            </ResourceSection>
                        </div>
                    </ScrollSurface>
                    <div class="shrink-0 border-t p-6">
                        <Button class="w-full" @click="fullDetail(selected)">
                            <ArrowUpRight aria-hidden="true" />
                            打开完整详情
                        </Button>
                    </div>
                </template>
            </SheetInspector>
        </div>
    </main>
</template>

<style scoped>
.material-branch-badge {
    background-color: color-mix(in oklch, var(--material-branch-color, var(--border)) 14%, var(--surface-tint-base));
    border-color: color-mix(in oklch, var(--material-branch-color, var(--border)) 25%, var(--surface-tint-base));
    color: oklch(from var(--material-branch-color, var(--muted-foreground)) 0.44 c h);
}
</style>
