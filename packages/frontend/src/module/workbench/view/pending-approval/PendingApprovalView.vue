<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    Check,
    CircleDot,
    ClipboardCheck,
    Shapes,
    UserRound,
    Link,
    Hash,
    CalendarDays,
    Eye,
    ExternalLink,
    Undo2,
} from '@lucide/vue';
import { useQueryCommand } from '@/platform/navigation';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useWorkspaceStore } from '@/module/workspace';
import { useWorkbenchStore } from '../../model/store';
import { formatDateTime } from '@/shared/util/date-time';
import { stateTone, type Approval, type Resource } from '../../model/workbench';
import { DataTable } from '@/component/data-table';
import type { DataTableAction, DataTableBulkAction, DataTableColumn, DataTableFilter } from '@/component/data-table';
import { SheetInspector } from '@/component/inspector';
import ResourceDialog from '../../ui/ResourceDialog.vue';
import { StateBadge } from '@/component/state-badge';
import ApprovalInspector from './ApprovalInspector.vue';
import WorkbenchSummary from '../../ui/WorkbenchSummary.vue';

const workspace = useWorkspaceStore();
const workbench = useWorkbenchStore();
const filters = ref<Record<string, string[]>>({ status: ['待审批'] });
const selectedId = ref<string | null>(null);
const checked = ref<string[]>([]);
const confirmBatch = ref(false);
const error = ref('');
const preview = ref<Resource | null>(null);
const resourceFor = (item: Approval) => workbench.resourceById.get(item.resourceId);
const summaries = computed(() => [
    {
        value: 'pending',
        label: '待审批',
        icon: ClipboardCheck,
        color: 'bg-caution-soft text-caution-soft-foreground',
        count: workbench.currentApprovals.filter((item) => item.status === '待审批').length,
    },
    {
        value: 'approved',
        label: '已批准',
        icon: Check,
        color: 'bg-success-soft text-success-soft-foreground',
        count: workbench.currentApprovals.filter((item) => item.status === '已批准').length,
    },
    {
        value: 'returned',
        label: '已退回',
        icon: Undo2,
        color: 'bg-destructive-soft text-destructive-soft-foreground',
        count: workbench.currentApprovals.filter((item) => item.status === '已退回').length,
    },
]);
const columns: DataTableColumn<Approval>[] = [
    { id: 'kind', label: '申请类型', icon: Shapes, size: 190, value: (item) => item.kind, class: 'min-w-36' },
    {
        id: 'applicant',
        label: '申请人',
        icon: UserRound,
        size: 110,
        value: (item) => item.applicant,
        class: 'whitespace-nowrap',
    },
    {
        id: 'resource',
        label: '对象',
        icon: Link,
        size: 250,
        value: (item) => resourceFor(item)?.name ?? '',
        class: 'min-w-48',
    },
    {
        id: 'quantity',
        label: '数量',
        icon: Hash,
        align: 'left',
        size: 100,
        value: (item) => item.quantity,
        class: 'whitespace-nowrap',
    },
    {
        id: 'createdAt',
        label: '申请时间',
        icon: CalendarDays,
        size: 200,
        value: (item) => item.createdAt,
        filterValue: (item) => formatDateTime(item.createdAt),
        class: 'whitespace-nowrap',
    },
    { id: 'status', label: '状态', icon: CircleDot, size: 110, value: (item) => item.status },
];
const filterFields = computed<DataTableFilter<Approval>[]>(() => [
    {
        id: 'kind',
        label: '申请类型',
        mode: 'options',
        value: (item) => item.kind,
        options: [...['领用申请', '库存转移', '设备操作', '检测结果审核'].map((value) => ({ value, label: value }))],
    },
    {
        id: 'status',
        label: '审批状态',
        mode: 'options',
        value: (item) => item.status,
        options: [...['待审批', '已批准', '已退回'].map((value) => ({ value, label: value }))],
    },
]);
const actions: DataTableAction<Approval>[] = [
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
        id: 'approve',
        label: '批准申请',
        icon: Check,
        disabled: (item) => !!workbench.syncError || item.status !== '待审批' || item.quantity > item.available,
        run: (item) => {
            checked.value = [item.id];
            confirmBatch.value = true;
        },
    },
    {
        id: 'return',
        label: '填写退回意见',
        icon: Undo2,
        disabled: (item) => !!workbench.syncError || item.status !== '待审批',
        run: (item) => {
            selectedId.value = item.id;
        },
    },
];
const bulkActions: DataTableBulkAction<Approval>[] = [
    {
        id: 'approve',
        label: '批准申请',
        icon: Check,
        disabled: (items) =>
            !!workbench.syncError || items.some((item) => item.status !== '待审批' || item.quantity > item.available),
        get disabledReason() {
            return workbench.syncError ? '请先重新同步工作台数据' : '仅可批准待审批且可用数量充足的申请';
        },
        run: () => {
            confirmBatch.value = true;
        },
    },
];
useQueryCommand('approval', (id) => {
    selectedId.value = id;
    filters.value = {};
});
const selected = computed(() => workbench.currentApprovals.find((item) => item.id === selectedId.value));
const inspectorOpen = computed({
    get: () => !!selected.value,
    set: (value) => {
        if (!value) selectedId.value = null;
    },
});
const batchError = computed(() => {
    const insufficient = workbench.currentApprovals.filter(
        (item) => checked.value.includes(item.id) && item.quantity > item.available
    );
    return insufficient.length
        ? `${insufficient.map((item) => resourceFor(item)?.name ?? item.kind).join('、')} 的可用数量不足，请先取消选择这些申请。`
        : '';
});
const searchText = (item: Approval) => `${item.id} ${item.applicant} ${resourceFor(item)?.name} ${item.resourceId}`;
async function approveBatch() {
    if (batchError.value) return;
    const ids = [...checked.value];
    error.value = await workbench.decideApprovals(ids, '已批准', '');
    if (!error.value) {
        checked.value = [];
        confirmBatch.value = false;
    }
}
watch(
    () => workspace.activeId,
    () => {
        selectedId.value = null;
        checked.value = [];
        preview.value = null;
        confirmBatch.value = false;
        error.value = '';
    }
);
</script>

<template>
    <main aria-label="待审批" class="flex min-h-0 flex-1 flex-col p-4 pt-2 lg:p-6 lg:pt-2">
        <div class="mx-auto w-full min-w-0 max-w-[1200px]" data-slot="workbench-content">
            <p v-if="error" role="alert" class="mb-3 text-sm text-destructive">{{ error }}</p>
            <WorkbenchSummary label="审批概览" :items="summaries" />
            <SheetInspector v-model:open="inspectorOpen" title="申请详情">
                <template #main>
                    <DataTable
                        v-model:filters="filters"
                        v-model:selected="checked"
                        :data="workbench.currentApprovals"
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
                        :initial-sorting="[{ id: 'createdAt', desc: true }]"
                        :selectable="(item) => item.status === '待审批'"
                        search-label="搜索申请、对象或申请人"
                        empty-text="没有符合条件的申请"
                    >
                        <template #cell-kind="{ row }">
                            <button
                                class="group flex w-full items-center gap-3 rounded-sm text-left after:absolute after:inset-0"
                                :aria-label="`查看${row.applicant}的${row.kind}`"
                                @click="selectedId = row.id"
                            >
                                <ClipboardCheck class="size-5 shrink-0 text-primary" aria-hidden="true" />
                                <span class="font-medium group-hover:underline group-focus-visible:underline">
                                    {{ row.kind }}
                                </span>
                            </button>
                        </template>
                        <template #cell-resource="{ row }">
                            <span class="block">{{ resourceFor(row)?.name }}</span>
                        </template>
                        <template #cell-quantity="{ row }">
                            <span class="tabular-nums">{{ row.quantity }} {{ row.unit }}</span>
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
                    <ApprovalInspector
                        v-if="selected"
                        :key="selected.id"
                        :approval="selected"
                        :resource="resourceFor(selected)"
                        @close="close"
                        @resource="preview = $event"
                    />
                </template>
            </SheetInspector>
        </div>
        <Dialog v-model:open="confirmBatch">
            <DialogContent>
                <DialogTitle>批准 {{ checked.length }} 项申请？</DialogTitle>
                <DialogDescription>申请批准后将更新审批状态。</DialogDescription>
                <p
                    v-if="batchError"
                    role="alert"
                    class="rounded-md bg-destructive-soft p-3 text-sm text-destructive-soft-foreground"
                >
                    {{ batchError }}
                </p>
                <div class="mt-3 flex justify-end gap-3">
                    <Button variant="outline" @click="confirmBatch = false">取消</Button>
                    <Button
                        :disabled="!!batchError || !checked.length || workbench.busy || !!workbench.syncError"
                        @click="approveBatch"
                    >
                        <Check aria-hidden="true" />
                        确认批准
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        <ResourceDialog v-model="preview" />
    </main>
</template>
