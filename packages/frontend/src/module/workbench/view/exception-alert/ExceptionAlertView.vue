<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
    Bell,
    CircleAlert,
    CircleDot,
    Shapes,
    TriangleAlert,
    Link,
    CalendarDays,
    Eye,
    ExternalLink,
    Check,
    EyeOff,
} from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { useWorkbenchStore } from '../../model/store';
import { formatDateTime } from '@/shared/util/date-time';
import { exceptionTone, stateTone, type ExceptionItem, type Resource } from '../../model/workbench';
import { DataTable } from '@/component/data-table';
import type { DataTableAction, DataTableBulkAction, DataTableColumn, DataTableFilter } from '@/component/data-table';
import { SheetInspector } from '@/component/inspector';
import ResourceDialog from '../../ui/ResourceDialog.vue';
import { StateBadge } from '@/component/state-badge';
import ExceptionInspector from './ExceptionInspector.vue';
import WorkbenchSummary from '../../ui/WorkbenchSummary.vue';

const workspace = useWorkspaceStore();
const workbench = useWorkbenchStore();
const route = useRoute();
const filters = ref<Record<string, string[]>>({ status: ['未处理'] });
const checked = ref<string[]>([]);
const selectedId = ref<string | null>(typeof route.query.exception === 'string' ? route.query.exception : null);
const error = ref('');
const preview = ref<Resource | null>(null);
const resourceFor = (item: ExceptionItem) => workbench.resourceById.get(item.resourceId);
const scoped = computed(() => workbench.currentExceptions);
const summaries = computed(() => [
    {
        value: '严重',
        label: '严重异常',
        icon: CircleAlert,
        color: 'bg-destructive-soft text-destructive-soft-foreground',
        count: scoped.value.filter((item) => item.severity === '严重' && item.status === '未处理').length,
    },
    {
        value: '一般',
        label: '一般异常',
        icon: TriangleAlert,
        color: 'bg-caution-soft text-caution-soft-foreground',
        count: scoped.value.filter((item) => item.severity === '一般' && item.status === '未处理').length,
    },
    {
        value: '提示',
        label: '提醒',
        icon: Bell,
        color: 'bg-primary-soft text-primary-soft-foreground',
        count: scoped.value.filter((item) => item.severity === '提示' && item.status === '未处理').length,
    },
]);
const columns: DataTableColumn<ExceptionItem>[] = [
    { id: 'title', label: '异常与提醒', icon: Bell, size: 280, value: (item) => item.title, class: 'min-w-56' },
    { id: 'kind', label: '类型', icon: Shapes, size: 110, value: (item) => item.kind, class: 'whitespace-nowrap' },
    {
        id: 'resource',
        label: '关联对象',
        icon: Link,
        size: 230,
        value: (item) => resourceFor(item)?.name ?? '',
        class: 'min-w-44',
    },
    { id: 'severity', label: '等级', icon: TriangleAlert, size: 110, value: (item) => item.severity },
    {
        id: 'createdAt',
        label: '发生时间',
        icon: CalendarDays,
        size: 200,
        value: (item) => item.createdAt,
        filterValue: (item) => formatDateTime(item.createdAt),
        class: 'whitespace-nowrap',
    },
    { id: 'status', label: '处理状态', icon: CircleDot, size: 120, value: (item) => item.status },
];
const filterFields = computed<DataTableFilter<ExceptionItem>[]>(() => [
    {
        id: 'severity',
        label: '异常等级',
        mode: 'options',
        value: (item) => item.severity,
        options: [...['严重', '一般', '提示'].map((value) => ({ value, label: value }))],
    },
    {
        id: 'kind',
        label: '异常类型',
        mode: 'options',
        value: (item) => item.kind,
        options: [...['库存', '设备', '临期'].map((value) => ({ value, label: value }))],
    },
    {
        id: 'status',
        label: '异常处理状态',
        mode: 'options',
        value: (item) => item.status,
        options: [...['未处理', '已处理', '已忽略'].map((value) => ({ value, label: value }))],
    },
]);
const actions: DataTableAction<ExceptionItem>[] = [
    {
        id: 'detail',
        label: '详情',
        icon: Eye,
        primary: true,
        run: (item) => {
            selectedId.value = item.id;
        },
    },
    {
        id: 'resource',
        label: '查看关联对象',
        icon: ExternalLink,
        disabled: (item) => !resourceFor(item),
        run: (item) => {
            preview.value = resourceFor(item) ?? null;
        },
    },
    {
        id: 'handle',
        label: '标记已处理',
        icon: Check,
        disabled: (item) => item.status !== '未处理',
        run: async (item) => {
            error.value = await workbench.updateException(item.id, '已处理');
        },
    },
    {
        id: 'ignore',
        label: '忽略提醒',
        icon: EyeOff,
        disabled: (item) => item.status !== '未处理',
        run: async (item) => {
            error.value = await workbench.updateException(item.id, '已忽略');
        },
    },
];
const bulkActions: DataTableBulkAction<ExceptionItem>[] = [
    {
        id: 'handle',
        label: '标记已处理',
        icon: Check,
        disabled: (items) => items.some((item) => item.status !== '未处理'),
        disabledReason: '仅支持未处理的异常与提醒',
        run: (items) => updateBatch(items, '已处理'),
    },
    {
        id: 'ignore',
        label: '忽略提醒',
        icon: EyeOff,
        disabled: (items) => items.some((item) => item.status !== '未处理'),
        disabledReason: '仅支持未处理的异常与提醒',
        run: (items) => updateBatch(items, '已忽略'),
    },
];
async function updateBatch(items: ExceptionItem[], status: '已处理' | '已忽略') {
    error.value = await workbench.updateExceptions(
        items.map((item) => item.id),
        status
    );
    if (!error.value) checked.value = [];
}
const selected = computed(() => workbench.currentExceptions.find((item) => item.id === selectedId.value));
const inspectorOpen = computed({
    get: () => !!selected.value,
    set: (value) => {
        if (!value) selectedId.value = null;
    },
});
const searchText = (item: ExceptionItem) => `${item.title} ${item.id} ${item.resourceId} ${resourceFor(item)?.name}`;
watch(
    () => route.query.exception,
    (id) => {
        if (typeof id === 'string') selectedId.value = id;
    }
);
watch(
    () => workspace.activeId,
    () => {
        selectedId.value = null;
        checked.value = [];
        error.value = '';
        preview.value = null;
    }
);
</script>

<template>
    <main aria-label="异常与提醒" class="flex min-h-0 flex-1 flex-col p-4 pt-2 lg:p-6 lg:pt-2">
        <div class="mx-auto min-w-0 w-fit max-w-full" data-slot="workbench-content">
            <p v-if="error" role="alert" class="mb-3 text-sm text-destructive">{{ error }}</p>
            <WorkbenchSummary label="异常概览" :items="summaries" />
            <SheetInspector v-model:open="inspectorOpen" title="异常详情">
                <template #main>
                    <DataTable
                        v-model:filters="filters"
                        v-model:selected="checked"
                        :data="workbench.currentExceptions"
                        :columns="columns"
                        :actions="actions"
                        :bulk-actions="bulkActions"
                        :busy="workbench.busy"
                        :filter-fields="filterFields"
                        :search-text="searchText"
                        :active-id="selectedId"
                        :initial-sorting="[{ id: 'createdAt', desc: true }]"
                        :selectable="(item) => item.status === '未处理'"
                        search-label="搜索异常或关联对象"
                        empty-text="没有符合条件的异常与提醒"
                    >
                        <template #cell-title="{ row }">
                            <button
                                class="group flex w-full items-center gap-3 rounded-sm text-left after:absolute after:inset-0"
                                :aria-label="`查看${row.title}`"
                                @click="selectedId = row.id"
                            >
                                <TriangleAlert
                                    class="size-5 shrink-0"
                                    :style="{ color: `var(--${exceptionTone(row)}-soft-foreground)` }"
                                    aria-hidden="true"
                                />
                                <span class="font-medium group-hover:underline group-focus-visible:underline">
                                    {{ row.title }}
                                </span>
                            </button>
                        </template>
                        <template #cell-resource="{ row }">
                            <span class="block">{{ resourceFor(row)?.name }}</span>
                        </template>
                        <template #cell-severity="{ row }">
                            <StateBadge :tone="exceptionTone(row)">{{ row.severity }}</StateBadge>
                        </template>
                        <template #cell-createdAt="{ row }">
                            <span class="tabular-nums">{{ formatDateTime(row.createdAt) }}</span>
                        </template>
                        <template #cell-status="{ row }">
                            <StateBadge :tone="stateTone(row.status)">{{ row.status }}</StateBadge>
                        </template>
                    </DataTable>
                </template>
                <template #default="{ close }">
                    <ExceptionInspector
                        v-if="selected"
                        :key="selected.id"
                        :exception="selected"
                        :resource="resourceFor(selected)"
                        @close="close"
                        @resource="preview = $event"
                    />
                </template>
            </SheetInspector>
        </div>
        <ResourceDialog v-model="preview" />
    </main>
</template>
