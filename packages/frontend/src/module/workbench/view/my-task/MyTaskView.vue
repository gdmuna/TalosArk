<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQueryCommand } from '@/platform/navigation';
import {
    CalendarDays,
    Check,
    CircleDot,
    ClipboardCheck,
    ListTodo,
    Shapes,
    Link,
    UserRound,
    Eye,
    ExternalLink,
    TriangleAlert,
} from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { useWorkbenchStore } from '../../model/store';
import { workbenchPage } from '../../navigation';
import { formatDateTime } from '@/shared/util/date-time';
import { type Resource, type Task } from '../../model/workbench';
import { DataTable } from '@/component/data-table';
import type { DataTableAction, DataTableBulkAction, DataTableColumn, DataTableFilter } from '@/component/data-table';
import { SheetInspector } from '@/component/inspector';
import ResourceDialog from '../../ui/ResourceDialog.vue';
import { StateBadge } from '@/component/state-badge';
import TaskInspector from './TaskInspector.vue';
import WorkbenchSummary from '../../ui/WorkbenchSummary.vue';

const workspace = useWorkspaceStore();
const workbench = useWorkbenchStore();
const router = useRouter();
const filters = ref<Record<string, string[]>>({ status: ['待处理', '已逾期'] });
const checked = ref<string[]>([]);
const error = ref('');
const preview = ref<Resource | null>(null);
const selectedId = ref<string | null>(null);
const overdue = workbench.overdue;
const displayStatus = workbench.displayStatus;
const isToday = workbench.today;
const resourceFor = (item: Task) => workbench.resourceById.get(item.resourceId);
const currentTasks = computed(() => workbench.currentTasks);
const summaries = computed(() => [
    {
        value: 'pending',
        label: '待处理',
        icon: ListTodo,
        color: 'bg-primary-soft text-primary-soft-foreground',
        count: currentTasks.value.filter((item) => item.status === '待处理' && !overdue(item)).length,
    },
    {
        value: 'overdue',
        label: '已逾期',
        icon: TriangleAlert,
        color: 'bg-destructive-soft text-destructive-soft-foreground',
        count: currentTasks.value.filter(overdue).length,
    },
    {
        value: 'today',
        label: '今日到期',
        icon: CalendarDays,
        color: 'bg-caution-soft text-caution-soft-foreground',
        count: currentTasks.value.filter((item) => item.status === '待处理' && isToday(item.dueAt)).length,
    },
]);
const columns: DataTableColumn<Task>[] = [
    { id: 'title', label: '任务标题', icon: ListTodo, size: 280, value: (item) => item.title, class: 'min-w-56' },
    { id: 'kind', label: '类型', icon: Shapes, size: 110, value: (item) => item.kind, class: 'whitespace-nowrap' },
    {
        id: 'resource',
        label: '关联对象',
        icon: Link,
        size: 220,
        value: (item) => resourceFor(item)?.name ?? '',
        class: 'min-w-40',
    },
    {
        id: 'applicant',
        label: '申请人',
        icon: UserRound,
        size: 110,
        value: (item) => item.applicant,
        class: 'whitespace-nowrap',
    },
    {
        id: 'dueAt',
        label: '截止时间',
        icon: CalendarDays,
        size: 200,
        value: (item) => item.dueAt,
        class: 'whitespace-nowrap',
    },
    { id: 'status', label: '状态', icon: CircleDot, size: 110, value: displayStatus },
];
const filterFields = computed<DataTableFilter<Task>[]>(() => [
    {
        id: 'kind',
        label: '类型',
        mode: 'options',
        value: (item) => item.kind,
        options: ['任务', '审批'].map((value) => ({ value, label: value })),
    },
    {
        id: 'status',
        label: '任务状态',
        mode: 'options',
        value: displayStatus,
        options: [
            { value: '待处理', label: '待处理' },
            { value: '已逾期', label: '已逾期' },
            { value: '已完成', label: '已完成' },
        ],
    },
    {
        id: 'dueAt',
        label: '截止时间',
        mode: 'options',
        value: (item) => String(item.dueAt),
        matches: (item, value) => (value === 'today' ? isToday(item.dueAt) : value === 'overdue' && overdue(item)),
        options: [
            { value: 'today', label: '今天', count: currentTasks.value.filter((item) => isToday(item.dueAt)).length },
            { value: 'overdue', label: '已逾期', count: currentTasks.value.filter(overdue).length },
        ],
    },
]);
function openApproval(id?: string) {
    if (id) router.push({ path: workbenchPage.approval.path, query: { approval: id } });
}
const actions: DataTableAction<Task>[] = [
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
        id: 'approval',
        label: '前往审批',
        icon: ClipboardCheck,
        disabled: (item) => !item.approvalId,
        run: (item) => openApproval(item.approvalId),
    },
    {
        id: 'complete',
        label: '完成任务',
        icon: Check,
        disabled: (item) => workbench.syncPending || item.kind !== '任务' || item.status !== '待处理',
        run: (item) => complete([item.id]),
    },
];
const bulkActions: DataTableBulkAction<Task>[] = [
    {
        id: 'complete',
        label: '完成任务',
        icon: Check,
        disabled: (items) =>
            workbench.syncPending || items.some((item) => item.kind !== '任务' || item.status !== '待处理'),
        get disabledReason() {
            return workbench.syncError ? '请先重新同步工作台数据' : '仅支持待处理的普通任务；审批申请请进入审批流程';
        },
        run: (items) => complete(items.map((item) => item.id)),
    },
];
const selectedTask = computed(() => currentTasks.value.find((item) => item.id === selectedId.value));
const inspectorOpen = computed({
    get: () => !!selectedTask.value,
    set: (value) => {
        if (!value) selectedId.value = null;
    },
});
const searchText = (item: Task) =>
    `${item.title} ${item.subtitle} ${item.applicant} ${resourceFor(item)?.name} ${item.resourceId}`;
async function complete(ids: string[]) {
    const pending = currentTasks.value.filter(
        (item) => ids.includes(item.id) && item.status === '待处理' && item.kind === '任务'
    );
    const result = await workbench.completeTasks(pending.map((item) => item.id));
    error.value = result ?? '';
    if (result === '') {
        checked.value = [];
        preview.value = null;
    }
}
watch(
    () => workspace.activeId,
    () => {
        selectedId.value = null;
        checked.value = [];
        error.value = '';
    }
);
useQueryCommand('task', (id) => {
    selectedId.value = id;
});
</script>

<template>
    <main aria-label="我的待办" class="flex min-h-0 flex-1 flex-col p-4 pt-2 lg:p-6 lg:pt-2">
        <div class="mx-auto w-fit min-w-0 max-w-full" data-slot="workbench-content">
            <p v-if="error" role="alert" class="mb-3 text-sm text-destructive">{{ error }}</p>
            <WorkbenchSummary label="待办概览" :items="summaries" />
            <SheetInspector v-model:open="inspectorOpen" title="任务详情">
                <template #main>
                    <DataTable
                        v-model:filters="filters"
                        v-model:selected="checked"
                        :data="currentTasks"
                        :columns="columns"
                        :actions="actions"
                        :bulk-actions="bulkActions"
                        :busy="workbench.busy"
                        :filter-fields="filterFields"
                        :search-text="searchText"
                        :active-id="selectedId"
                        :preview="
                            (row) => {
                                selectedId = row.id;
                            }
                        "
                        :initial-sorting="[{ id: 'dueAt', desc: false }]"
                        :selectable="(item) => item.status === '待处理'"
                        search-label="搜索任务、对象或申请人"
                        empty-text="没有符合条件的任务"
                    >
                        <template #cell-title="{ row }">
                            <button
                                class="group flex w-full items-start gap-3 rounded-sm text-left after:absolute after:inset-0"
                                :aria-label="`查看${row.title}`"
                                @click="selectedId = row.id"
                            >
                                <component
                                    :is="row.kind === '审批' ? ClipboardCheck : ListTodo"
                                    class="mt-0.5 size-5 shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <span>
                                    <span class="block font-medium group-hover:underline group-focus-visible:underline">
                                        {{ row.title }}
                                    </span>
                                    <span class="mt-1 block text-xs text-muted-foreground">{{ row.subtitle }}</span>
                                </span>
                            </button>
                        </template>
                        <template #cell-resource="{ row }">
                            <span class="block">{{ resourceFor(row)?.name }}</span>
                        </template>
                        <template #cell-dueAt="{ row }">
                            <span class="tabular-nums">
                                {{ formatDateTime(row.dueAt) }}
                            </span>
                        </template>
                        <template #cell-status="{ row }">
                            <StateBadge
                                :tone="row.status === '已完成' ? 'success' : overdue(row) ? 'destructive' : 'warning'"
                            >
                                {{ displayStatus(row) }}
                            </StateBadge>
                        </template>
                    </DataTable>
                </template>
                <template #default>
                    <TaskInspector
                        v-if="selectedTask"
                        :task="selectedTask"
                        :resource="resourceFor(selectedTask)"
                        :busy="workbench.busy"
                        class="h-full min-h-0 bg-card p-5 pt-10"
                        @complete="complete([$event])"
                        @approval="openApproval"
                        @resource="preview = $event"
                    />
                </template>
            </SheetInspector>
        </div>
        <ResourceDialog v-model="preview" />
    </main>
</template>
