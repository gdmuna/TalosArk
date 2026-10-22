<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Check, X, ClipboardCheck, Clock3, Eye, FileText, Plus, RotateCw } from '@lucide/vue';
import type { PaginationState } from '@tanstack/vue-table';
import type { ApprovalQuery, ApprovalRequest } from '@talos-ark/contracts/approval';
import { DataTable, type DataTableBulkAction, type DataTableColumn } from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { ButtonGroup } from '@/ui/button-group';
import { Button } from '@/ui/button';
import { useApprovalRead } from '../model/read';
import { useApprovalOperationStore } from '../model/operation';
import { approvalStatusLabel, approvalTypeLabel } from '../model/presentation';
import ApprovalOperationNotice from './ApprovalOperationNotice.vue';
import ApprovalBatchSheet from './ApprovalBatchSheet.vue';
import type { ApprovalBatchSelection } from '../model/batch';
import { isResponseValidationError } from '@/platform/http';
const props = withDefaults(defineProps<{ initialView?: 'review' | 'execute'; allowMine?: boolean }>(), {
    initialView: 'execute',
    allowMine: false,
});
const route = useRoute(),
    router = useRouter(),
    store = useApprovalOperationStore();
const mode = computed(() => (props.allowMine && route.query.view === 'mine' ? 'mine' : props.initialView));
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const checked = ref<string[]>([]),
    batchOpen = ref(false),
    batchSelection = ref<ApprovalBatchSelection>();
const query = computed<ApprovalQuery>(() => ({
    view: mode.value,
    page: pagination.value.pageIndex + 1,
    pageSize: pagination.value.pageSize,
}));
const list = useApprovalRead(
    computed(() => JSON.stringify(query.value)),
    (source, scope, signal) => source.list(scope, query.value, signal)
);
const summary = useApprovalRead(
    computed(() => 'summary'),
    (source, scope, signal) => source.summary(scope, signal)
);
watch(
    [mode, list.scope],
    () => {
        pagination.value.pageIndex = 0;
        checked.value = [];
        batchOpen.value = false;
    },
    { flush: 'sync' }
);
const title = computed(() => (mode.value === 'review' ? '待审批' : mode.value === 'mine' ? '我的申请' : '待执行'));
const columns: DataTableColumn<ApprovalRequest>[] = [
    { id: 'title', label: '申请', icon: FileText, size: 300, fill: true, sortable: false, value: (row) => row.title },
    { id: 'type', label: '动作', size: 130, sortable: false, value: (row) => approvalTypeLabel[row.type] },
    {
        id: 'createdAt',
        label: '提交时间',
        size: 190,
        sortable: false,
        value: (row) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }),
    },
    { id: 'lines', label: '明细', size: 100, sortable: false, value: (row) => row.totalLines },
    { id: 'decision', label: '审批结果', size: 130, sortable: false, value: approvalStatusLabel },
    {
        id: 'execution',
        label: '执行进度',
        size: 190,
        sortable: false,
        value: (row) => `待执行 ${row.executions.pending} · 已执行 ${row.executions.executed}`,
    },
];
const open = (row: ApprovalRequest) => {
    void router.push(`/main/workbench/request/${row.id}`);
};
const batch = computed(() => store.batch.current(store.batchKey(list.scope.value)));
const bulkActions = computed<DataTableBulkAction<ApprovalRequest>[]>(() =>
    mode.value !== 'review'
        ? []
        : (['APPROVED', 'REJECTED'] as const).map((decision) => ({
              id: decision,
              label: decision === 'APPROVED' ? '批量批准' : '批量拒绝',
              icon: decision === 'APPROVED' ? Check : X,
              disabled: (rows) =>
                  rows.length > 100 ||
                  rows.some((row) => !row.actions.decide) ||
                  store.busy ||
                  !!store.current(list.scope.value) ||
                  !!batch.value ||
                  !!store.recoveryError ||
                  !!store.batch.error,
              run: (rows) => {
                  batchSelection.value = { kind: 'decide', decision, requestIds: rows.map((row) => row.id) };
                  batchOpen.value = true;
              },
          }))
);
async function synchronize() {
    const current = list.scope.value;
    if (
        (await list.refresh()) &&
        (await summary.refresh()) &&
        current &&
        current.organizationId === list.scope.value?.organizationId &&
        current.workspaceId === list.scope.value?.workspaceId
    ) {
        store.acknowledge(current);
        return true;
    }
    return false;
}
</script>
<template>
    <main :aria-label="title" class="min-w-0 flex-1 p-4 pt-2 lg:p-6 lg:pt-2">
        <div class="mx-auto w-full max-w-[1200px] space-y-5" data-slot="approval-queue">
            <section aria-label="审批概览" class="flex flex-wrap gap-3">
                <div
                    v-for="item in [
                        { label: '待我审批', count: summary.data.value?.pendingReview, icon: ClipboardCheck },
                        { label: '待我执行', count: summary.data.value?.pendingExecution, icon: Clock3 },
                    ]"
                    :key="item.label"
                    class="flex w-56 max-w-full items-center gap-3 rounded-lg border bg-card p-4 shadow-xs"
                >
                    <span
                        class="flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground"
                    >
                        <component :is="item.icon" class="size-5" aria-hidden="true" />
                    </span>
                    <div>
                        <p class="text-sm text-muted-foreground">{{ item.label }}</p>
                        <p class="mt-1 text-xl font-semibold tabular-nums">{{ item.count ?? '—' }}</p>
                    </div>
                </div>
            </section>
            <p v-if="summary.error.value" role="alert" class="text-sm text-destructive">{{ summary.error.value }}</p>
            <header class="flex flex-wrap items-center justify-between gap-3">
                <ButtonGroup v-if="allowMine" aria-label="申请视图">
                    <Button
                        :variant="mode === 'execute' ? 'secondary' : 'outline'"
                        :aria-pressed="mode === 'execute'"
                        @click="router.replace({ query: { ...route.query, view: undefined } })"
                    >
                        待执行
                    </Button>
                    <Button
                        :variant="mode === 'mine' ? 'secondary' : 'outline'"
                        :aria-pressed="mode === 'mine'"
                        @click="router.replace({ query: { ...route.query, view: 'mine' } })"
                    >
                        我的申请
                    </Button>
                </ButtonGroup>
                <h1 v-else class="text-lg font-semibold">{{ title }}</h1>
                <div class="flex items-center gap-2">
                    <Button v-if="batch" variant="outline" @click="batchOpen = true">核对批量操作</Button>
                    <Button
                        variant="outline"
                        size="icon"
                        use-tooltip
                        aria-label="重新加载申请"
                        :disabled="list.loading.value"
                        @click="synchronize"
                    >
                        <RotateCw aria-hidden="true" />
                    </Button>
                    <Button @click="router.push('/main/workbench/request/new')">
                        <Plus aria-hidden="true" />
                        新建申请
                    </Button>
                </div>
            </header>
            <ApprovalOperationNotice
                :silent="
                    !list.error.value &&
                    !summary.error.value &&
                    (isResponseValidationError(list.failure.value) || isResponseValidationError(summary.failure.value))
                "
                @synchronize="synchronize"
            />
            <div
                v-if="list.error.value"
                role="alert"
                class="flex items-center justify-between gap-3 border-y py-4 text-sm"
            >
                <span class="text-destructive">{{ list.error.value }}</span>
                <Button variant="outline" @click="synchronize">重新加载</Button>
            </div>
            <DataTable
                v-model:selected="checked"
                v-model:pagination="pagination"
                :data="list.data.value?.items ?? []"
                :columns="columns"
                :server-total="list.data.value?.total ?? 0"
                :searchable="false"
                :filtering="false"
                :busy="list.loading.value"
                :selectable="mode === 'review' ? (row) => row.actions.decide : undefined"
                :bulk-actions="bulkActions"
                :preview="open"
                :actions="[{ id: 'detail', label: '详情', icon: Eye, primary: true, run: open }]"
                :empty-text="
                    list.error.value
                        ? '申请加载失败'
                        : list.loading.value
                          ? '正在加载申请'
                          : mode === 'review'
                            ? '暂无待审批申请'
                            : mode === 'execute'
                              ? '暂无待执行申请'
                              : '尚未提交申请'
                "
            >
                <template #cell-title="{ row }">
                    <button
                        class="group flex w-full items-center gap-3 text-left after:absolute after:inset-0"
                        @click="open(row)"
                    >
                        <ClipboardCheck class="size-5 shrink-0 text-primary" aria-hidden="true" />
                        <span class="min-w-0 font-medium group-hover:underline group-focus-visible:underline">
                            {{ row.title }}
                        </span>
                    </button>
                </template>
                <template #cell-decision="{ row }">
                    <StateBadge
                        :tone="row.status === 'PENDING' ? 'warning' : row.decisions.approved ? 'success' : 'neutral'"
                    >
                        {{ approvalStatusLabel(row) }}
                    </StateBadge>
                </template>
                <template #cell-execution="{ row }">
                    <span v-if="row.status === 'DECIDED' && row.decisions.approved" class="text-sm tabular-nums">
                        待执行 {{ row.executions.pending }} · 已执行 {{ row.executions.executed }}
                    </span>
                    <span v-else class="text-muted-foreground">—</span>
                </template>
            </DataTable>
            <p v-if="allowMine" role="status" class="text-sm text-muted-foreground">普通任务暂不可用</p>
        </div>
        <ApprovalBatchSheet
            v-model:open="batchOpen"
            :scope="list.scope.value"
            :selection="batchSelection"
            :on-synchronized="synchronize"
        />
    </main>
</template>
