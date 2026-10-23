<script setup lang="ts">
import { computed, onScopeDispose, ref, watch, useId } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Ban, Check, ClipboardCheck, ExternalLink, Play, RotateCw, Send, Undo2, X } from '@lucide/vue';
import { ApprovalDecisionSchema, type ApprovalLine } from '@talos-ark/contracts/approval';
import {
    DataTable,
    type DataTableAction,
    type DataTableBulkAction,
    type DataTableColumn,
} from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { SelectField } from '@/component/select-field';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/dialog';
import { useApprovalRead, approvalErrorMessage } from '../model/read';
import { useApprovalOperationStore } from '../model/operation';
import { HttpError, isResponseValidationError } from '@/platform/http';
import type { ApprovalMutation } from '../data/source';
import {
    approvalStatusLabel,
    approvalTypeLabel,
    decisionLabel,
    executionLabel,
    blockedLabel,
} from '../model/presentation';
import ApprovalOperationNotice from './ApprovalOperationNotice.vue';
import ApprovalBatchSheet from './ApprovalBatchSheet.vue';
import type { ApprovalBatchSelection } from '../model/batch';
import { Field, FieldLabel } from '@/ui/field';
import { OverlayDraftDialog, useOverlayDraft } from '@/component/overlay-draft';

const formFieldId = useId();

type ReviewLine = ApprovalLine & { reviewDecision: 'UNDECIDED' | 'APPROVED' | 'REJECTED'; reviewOpinion: string };
const route = useRoute(),
    router = useRouter(),
    store = useApprovalOperationStore();
const id = computed(() => String(route.params.requestId ?? ''));
const pagination = ref({ pageIndex: 0, pageSize: 10 }),
    eventPage = ref(1);
const request = useApprovalRead(id, (source, scope, signal) => source.get(scope, id.value, signal));
const scope = request.scope;
const lineRead = useApprovalRead(
    computed(() => JSON.stringify([id.value, pagination.value])),
    (source, scope, signal) =>
        source.lines(
            scope,
            id.value,
            { page: pagination.value.pageIndex + 1, pageSize: pagination.value.pageSize },
            signal
        )
);
const history = useApprovalRead(
    computed(() => JSON.stringify([id.value, eventPage.value])),
    (source, scope, signal) => source.events(scope, id.value, { page: eventPage.value, pageSize: 10 }, signal)
);
const attempt = computed(() => store.current(scope.value));
const checked = ref<string[]>([]),
    batchOpen = ref(false),
    batchSelection = ref<ApprovalBatchSelection>();
const batch = computed(() => store.batch.current(store.batchKey(scope.value)));
const reviewLines = ref<ReviewLine[]>(),
    reviewVersion = ref(0),
    reviewLoading = ref(false),
    reviewError = ref(''),
    note = ref('');
let reviewRequest: AbortController | undefined;
const confirmation = ref<{
    kind: 'execute' | 'abandon' | 'revoke' | 'withdraw';
    line?: ApprovalLine;
    version: number;
}>();
const reason = ref('');
const confirmationOpen = computed({
    get: () => !!confirmation.value,
    set: (value) => {
        if (!value) confirmation.value = undefined;
    },
});
const { guardedOpen, confirmOpen, discard } = useOverlayDraft(confirmationOpen, () => reason.value, {
    busy: () => store.busy,
    saved: () => !!attempt.value,
});
const locked = computed(
    () =>
        store.busy ||
        !!attempt.value ||
        !!store.recoveryError ||
        store.batch.busy ||
        !!batch.value ||
        !!store.batch.error
);
const bulkActions = computed<DataTableBulkAction<ApprovalLine>[]>(() => [
    {
        id: 'execute',
        label: '执行所选明细',
        icon: Play,
        disabled: (rows) => locked.value || rows.length > 100 || rows.some((row) => !row.actions.execute),
        run: (rows) => {
            batchSelection.value = { kind: 'execute', requestId: id.value, lineIds: rows.map((row) => row.id) };
            batchOpen.value = true;
        },
    },
]);
watch(
    [id, scope],
    () => {
        reviewRequest?.abort();
        reviewLines.value = undefined;
        reviewLoading.value = false;
        confirmation.value = undefined;
        reviewError.value = '';
        pagination.value.pageIndex = 0;
        eventPage.value = 1;
        checked.value = [];
        batchOpen.value = false;
    },
    { flush: 'sync' }
);
onScopeDispose(() => reviewRequest?.abort());
async function startReview() {
    if (!scope.value || !request.source || locked.value || reviewLoading.value) return;
    reviewRequest?.abort();
    const controller = new AbortController();
    reviewRequest = controller;
    reviewLoading.value = true;
    reviewError.value = '';
    const current = scope.value,
        requestId = id.value;
    try {
        const header = await request.source.get(current, requestId, controller.signal);
        if (!header.actions.decide) throw new Error('当前无法审核此申请，请重新加载');
        const items: ReviewLine[] = [];
        for (let page = 1; ; page++) {
            const result = await request.source.lines(current, requestId, { page, pageSize: 100 }, controller.signal);
            if (controller.signal.aborted) return;
            if (result.total !== header.totalLines) throw new HttpError('申请明细发生变化', 'protocol');
            if (!result.items.length && items.length < result.total) throw new HttpError('申请明细不完整', 'protocol');
            items.push(
                ...result.items.map((line) => ({ ...line, reviewDecision: 'UNDECIDED' as const, reviewOpinion: '' }))
            );
            if (items.length >= result.total) break;
        }
        if (!controller.signal.aborted) {
            reviewLines.value = items;
            reviewVersion.value = header.version;
        }
    } catch (cause) {
        if (!controller.signal.aborted) reviewError.value = approvalErrorMessage(cause);
    } finally {
        if (!controller.signal.aborted) reviewLoading.value = false;
    }
}
const decisionsComplete = computed(
    () => !!reviewLines.value?.length && reviewLines.value.every((line) => line.reviewDecision !== 'UNDECIDED')
);
const approvedCount = computed(
    () => reviewLines.value?.filter((line) => line.reviewDecision === 'APPROVED').length ?? 0
);
async function synchronize() {
    const current = scope.value,
        requestId = id.value;
    const ready = (await request.refresh()) && (await lineRead.refresh()) && (await history.refresh());
    if (
        ready &&
        current &&
        id.value === requestId &&
        current.organizationId === scope.value?.organizationId &&
        current.workspaceId === scope.value?.workspaceId
    ) {
        store.acknowledge(current);
        reviewLines.value = undefined;
        return true;
    }
    return false;
}
// A submitted intent is already fixed; read its request before discarding the successful receipt.
watch(request.data, (value) => {
    const pending = attempt.value;
    if (
        value &&
        pending?.result &&
        pending.result.receipt.requestId === value.id &&
        scope.value &&
        pending.mutation.kind === 'submit'
    )
        store.acknowledge(scope.value);
});
async function decide() {
    if (!scope.value || !reviewLines.value || !decisionsComplete.value || locked.value) return;
    const body = ApprovalDecisionSchema.parse({
        expectedVersion: reviewVersion.value,
        idempotencyKey: crypto.randomUUID(),
        note: note.value,
        lines: reviewLines.value.map((line) => ({
            lineId: line.id,
            decision: line.reviewDecision,
            opinion: line.reviewOpinion,
        })),
    });
    await store.execute(scope.value, { kind: 'decide', requestId: id.value, body });
    if (attempt.value?.result) await synchronize();
}
function confirm(kind: 'execute' | 'abandon' | 'revoke' | 'withdraw', line?: ApprovalLine) {
    if (!request.data.value) return;
    reason.value = '';
    confirmation.value = { kind, line, version: line?.version ?? request.data.value.version };
}
async function perform() {
    if (!confirmation.value || !scope.value || locked.value) return;
    const action = confirmation.value,
        body = { expectedVersion: action.version, idempotencyKey: crypto.randomUUID() };
    let mutation: ApprovalMutation;
    if (action.kind === 'withdraw')
        mutation = { kind: 'withdraw', requestId: id.value, body: { ...body, note: reason.value } };
    else if (action.line)
        mutation =
            action.kind === 'execute'
                ? { kind: 'execute', requestId: id.value, lineId: action.line.id, body }
                : {
                      kind: action.kind,
                      requestId: id.value,
                      lineId: action.line.id,
                      body: { ...body, note: reason.value },
                  };
    else return;
    await store.execute(scope.value, mutation);
    if (attempt.value) confirmation.value = undefined;
    if (attempt.value?.result) await synchronize();
}
const actionLabel = { execute: '执行获批操作', abandon: '放弃明细', revoke: '撤销批准', withdraw: '撤回申请' } as const;
const columns: DataTableColumn<ApprovalLine>[] = [
    {
        id: 'stock',
        label: '库存实例',
        size: 230,
        fill: true,
        sortable: false,
        value: (row) => row.stock?.code ?? '资源受限',
    },
    {
        id: 'intent',
        label: '申请内容',
        size: 180,
        sortable: false,
        value: (row) =>
            row.requestedQuantity ? `${row.requestedQuantity} ${row.stock?.quantityUnit ?? ''}` : '整件转移',
    },
    {
        id: 'source',
        label: '申请来源',
        size: 240,
        sortable: false,
        value: (row) => row.source?.path ?? '位置受限或治理已改变',
    },
    {
        id: 'destination',
        label: '目标位置',
        size: 240,
        sortable: false,
        value: (row) =>
            row.destination?.path ?? (request.data.value?.type === 'CONSUME' ? '保持原位' : '位置受限或治理已改变'),
    },
    { id: 'decision', label: '审批结论', size: 140, sortable: false, value: (row) => decisionLabel[row.decision] },
    {
        id: 'execution',
        label: '执行状态',
        size: 220,
        sortable: false,
        value: (row) => (row.executionStatus ? executionLabel[row.executionStatus] : '—'),
    },
];
const reviewColumns = computed<DataTableColumn<ReviewLine>[]>(() => [
    ...columns.filter((column) => !['decision', 'execution'].includes(column.id)),
    { id: 'reviewDecision', label: '审批结论', size: 160, sortable: false, value: (row) => row.reviewDecision },
    { id: 'reviewOpinion', label: '明细意见', size: 220, sortable: false, value: (row) => row.reviewOpinion },
]);
const actions = computed<DataTableAction<ApprovalLine>[]>(() => [
    {
        id: 'execute',
        label: '执行',
        icon: Play,
        primary: true,
        disabled: (row) => locked.value || !row.actions.execute,
        run: (row) => confirm('execute', row),
    },
    {
        id: 'abandon',
        label: '放弃明细',
        icon: X,
        disabled: (row) => locked.value || !row.actions.abandon,
        run: (row) => confirm('abandon', row),
    },
    {
        id: 'revoke',
        label: '撤销批准',
        icon: Ban,
        disabled: (row) => locked.value || !row.actions.revoke,
        run: (row) => confirm('revoke', row),
    },
    {
        id: 'stock',
        label: '查看库存',
        icon: ExternalLink,
        disabled: (row) => !row.stock,
        run: (row) => {
            if (row.stock) void router.push(`/main/inventory/detail/${row.stock.stockItemId}`);
        },
    },
]);
const eventLabel: Record<string, string> = {
    SUBMITTED: '提交申请',
    DECIDED: '完成审批',
    WITHDRAWN: '撤回申请',
    ABANDONED: '放弃明细',
    REVOKED: '撤销批准',
    EXECUTED: '执行明细',
};
</script>
<template>
    <main aria-label="申请详情" class="min-w-0 p-4 pt-2 lg:p-6 lg:pt-2">
        <div class="mx-auto w-fit min-w-0 max-w-full space-y-6">
            <header class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        use-tooltip
                        aria-label="返回申请列表"
                        @click="router.push('/main/workbench/my-task?view=mine')"
                    >
                        <ArrowLeft />
                    </Button>
                    <div class="min-w-0">
                        <h1 class="break-words text-xl font-semibold">{{ request.data.value?.title ?? '申请详情' }}</h1>
                        <p v-if="request.data.value" class="mt-1 text-sm text-muted-foreground">
                            {{ approvalTypeLabel[request.data.value.type] }} ·
                            {{ request.data.value.totalLines }} 件实物
                        </p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button v-if="batch" variant="outline" @click="batchOpen = true">核对批量操作</Button>
                    <Button
                        variant="outline"
                        size="icon"
                        use-tooltip
                        aria-label="重新加载申请"
                        :disabled="request.loading.value"
                        @click="synchronize"
                    >
                        <RotateCw />
                    </Button>
                    <Button
                        v-if="request.data.value?.actions.withdraw"
                        variant="outline"
                        :disabled="locked"
                        @click="confirm('withdraw')"
                    >
                        <Undo2 />
                        撤回申请
                    </Button>
                    <Button
                        variant="outline"
                        :disabled="locked || !request.data.value"
                        @click="router.push({ path: '/main/workbench/request/new', query: { previous: id } })"
                    >
                        <Send />
                        重新申请
                    </Button>
                    <Button
                        v-if="request.data.value?.actions.decide && !reviewLines"
                        :disabled="locked || reviewLoading"
                        @click="startReview"
                    >
                        <ClipboardCheck />
                        {{ reviewLoading ? '正在加载全单明细' : '审核申请' }}
                    </Button>
                </div>
            </header>
            <ApprovalOperationNotice
                :silent="
                    !request.error.value &&
                    !lineRead.error.value &&
                    !history.error.value &&
                    [request.failure.value, lineRead.failure.value, history.failure.value].some(
                        isResponseValidationError
                    )
                "
                @synchronize="synchronize"
            />
            <p v-if="request.loading.value" role="status" class="text-sm text-muted-foreground">正在加载申请</p>
            <p v-if="request.error.value || reviewError" role="alert" class="text-sm text-destructive">
                {{ request.error.value || reviewError }}
            </p>
            <template v-if="request.data.value">
                <dl class="grid gap-4 border-y py-5 text-sm sm:grid-cols-4">
                    <div>
                        <dt class="text-muted-foreground">申请人</dt>
                        <dd class="mt-1">{{ request.data.value.requesterName }}</dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">审批人</dt>
                        <dd class="mt-1">{{ request.data.value.approverName }}</dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">申请时间</dt>
                        <dd class="mt-1 tabular-nums">
                            {{ new Date(request.data.value.createdAt).toLocaleString('zh-CN', { hour12: false }) }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">审批结果</dt>
                        <dd class="mt-1">
                            <StateBadge
                                :tone="
                                    request.data.value.status === 'PENDING'
                                        ? 'warning'
                                        : request.data.value.decisions.approved
                                          ? 'success'
                                          : 'neutral'
                                "
                            >
                                {{ approvalStatusLabel(request.data.value) }}
                            </StateBadge>
                        </dd>
                    </div>
                    <div v-if="request.data.value.description" class="sm:col-span-4">
                        <dt class="text-muted-foreground">申请说明</dt>
                        <dd class="mt-1 whitespace-pre-wrap break-words">{{ request.data.value.description }}</dd>
                    </div>
                </dl>
                <section v-if="reviewLines" aria-label="审核全单" class="space-y-4">
                    <header class="flex flex-wrap items-center justify-between gap-3">
                        <h2 class="text-base font-semibold">
                            审核全单
                            <span class="ml-1 text-sm font-normal text-muted-foreground">
                                已决定 {{ reviewLines.filter((row) => row.reviewDecision !== 'UNDECIDED').length }}/{{
                                    reviewLines.length
                                }}
                            </span>
                        </h2>
                        <div class="flex gap-2">
                            <Button
                                variant="outline"
                                :disabled="locked"
                                @click="reviewLines.forEach((row) => (row.reviewDecision = 'APPROVED'))"
                            >
                                全单批准
                            </Button>
                            <Button
                                variant="outline"
                                :disabled="locked"
                                @click="reviewLines.forEach((row) => (row.reviewDecision = 'REJECTED'))"
                            >
                                全单拒绝
                            </Button>
                        </div>
                    </header>
                    <DataTable :data="reviewLines" :columns="reviewColumns" :filtering="false" :searchable="false">
                        <template #cell-stock="{ row }">
                            <span class="font-medium">{{ row.stock?.code ?? '资源受限' }}</span>
                            <span class="mt-1 block text-xs text-muted-foreground">{{ row.stock?.materialName }}</span>
                        </template>
                        <template #cell-reviewDecision="{ row }">
                            <Field>
                                <FieldLabel :for="formFieldId + '-decision-' + row.lineNumber" class="sr-only">
                                    审批结论 {{ row.stock?.code ?? row.lineNumber }}
                                </FieldLabel>
                                <SelectField
                                    :id="formFieldId + '-decision-' + row.lineNumber"
                                    v-model="row.reviewDecision"
                                    :label="`审批结论 ${row.stock?.code ?? row.lineNumber}`"
                                    :disabled="locked"
                                    :options="[
                                        { value: 'UNDECIDED', label: '待选择' },
                                        { value: 'APPROVED', label: '批准' },
                                        { value: 'REJECTED', label: '拒绝' },
                                    ]"
                                />
                            </Field>
                        </template>
                        <template #cell-reviewOpinion="{ row }">
                            <Field>
                                <FieldLabel :for="formFieldId + '-opinion-' + row.lineNumber" class="sr-only">
                                    明细意见 {{ row.stock?.code ?? row.lineNumber }}
                                </FieldLabel>
                                <Input
                                    :id="formFieldId + '-opinion-' + row.lineNumber"
                                    v-model="row.reviewOpinion"
                                    :aria-label="`明细意见 ${row.stock?.code ?? row.lineNumber}`"
                                    :disabled="locked"
                                    maxlength="1000"
                                />
                            </Field>
                        </template>
                    </DataTable>
                    <Field class="max-w-xl">
                        <FieldLabel :for="formFieldId + '-1'">整体意见（选填）</FieldLabel>
                        <Textarea :id="formFieldId + '-1'" v-model="note" :disabled="locked" maxlength="1000" />
                    </Field>
                    <div class="flex flex-wrap items-center justify-between gap-3 border-y py-4">
                        <p class="text-sm text-muted-foreground">
                            批准 {{ approvedCount }} 件 · 拒绝
                            {{
                                reviewLines.length -
                                approvedCount -
                                reviewLines.filter((row) => row.reviewDecision === 'UNDECIDED').length
                            }}
                            件
                        </p>
                        <div class="flex gap-2">
                            <Button variant="outline" :disabled="locked" @click="reviewLines = undefined">
                                取消审核
                            </Button>
                            <Button :disabled="locked || !decisionsComplete" @click="decide">
                                <Check />
                                确认全单审批结论
                            </Button>
                        </div>
                    </div>
                </section>
                <section v-else aria-label="申请明细" class="space-y-3">
                    <header class="flex flex-wrap items-center justify-between gap-2">
                        <h2 class="text-base font-semibold">明细与执行进度</h2>
                        <p class="text-sm text-muted-foreground">
                            待执行 {{ request.data.value.executions.pending }} · 已执行
                            {{ request.data.value.executions.executed }} · 已终止
                            {{ request.data.value.executions.abandoned + request.data.value.executions.revoked }}
                        </p>
                    </header>
                    <p v-if="lineRead.error.value" role="alert" class="text-sm text-destructive">
                        {{ lineRead.error.value }}
                    </p>
                    <DataTable
                        v-model:selected="checked"
                        v-model:pagination="pagination"
                        :data="lineRead.data.value?.items ?? []"
                        :columns="columns"
                        :server-total="lineRead.data.value?.total ?? 0"
                        :searchable="false"
                        :filtering="false"
                        :actions="actions"
                        :busy="lineRead.loading.value"
                        :selectable="(row) => row.actions.execute"
                        :bulk-actions="bulkActions"
                    >
                        <template #cell-stock="{ row }">
                            <span class="font-medium">{{ row.stock?.code ?? '资源受限' }}</span>
                            <span class="mt-1 block text-xs text-muted-foreground">{{ row.stock?.materialName }}</span>
                        </template>
                        <template #cell-decision="{ row }">
                            <StateBadge
                                :tone="
                                    row.decision === 'APPROVED'
                                        ? 'success'
                                        : row.decision === 'UNDECIDED'
                                          ? 'warning'
                                          : 'neutral'
                                "
                            >
                                {{ decisionLabel[row.decision] }}
                            </StateBadge>
                            <span v-if="row.opinion" class="mt-1 block text-xs text-muted-foreground">
                                {{ row.opinion }}
                            </span>
                        </template>
                        <template #cell-execution="{ row }">
                            <span>{{ row.executionStatus ? executionLabel[row.executionStatus] : '—' }}</span>
                            <span v-if="row.blockedReason" class="mt-1 block text-xs text-muted-foreground">
                                {{ blockedLabel[row.blockedReason] ?? '暂不可执行' }}
                            </span>
                        </template>
                    </DataTable>
                </section>
                <section aria-label="审批历史" class="space-y-3">
                    <h2 class="text-base font-semibold">处理记录</h2>
                    <p v-if="history.error.value" role="alert" class="text-sm text-destructive">
                        {{ history.error.value }}
                    </p>
                    <ul class="divide-y border-y">
                        <li
                            v-for="event in history.data.value?.items"
                            :key="event.id"
                            class="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
                        >
                            <div>
                                <p>{{ event.actorName }} · {{ eventLabel[event.action] }}</p>
                                <p v-if="event.note" class="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                                    {{ event.note }}
                                </p>
                            </div>
                            <time class="text-xs text-muted-foreground">
                                {{ new Date(event.occurredAt).toLocaleString('zh-CN', { hour12: false }) }}
                            </time>
                        </li>
                    </ul>
                    <div
                        v-if="(history.data.value?.total ?? 0) > 10"
                        class="flex items-center justify-end gap-3 text-sm"
                    >
                        <Button variant="outline" size="sm" :disabled="eventPage === 1" @click="eventPage--">
                            上一页
                        </Button>
                        <span>第 {{ eventPage }} 页</span>
                        <Button
                            variant="outline"
                            size="sm"
                            :disabled="eventPage * 10 >= (history.data.value?.total ?? 0)"
                            @click="eventPage++"
                        >
                            下一页
                        </Button>
                    </div>
                </section>
            </template>
        </div>
        <ApprovalBatchSheet
            v-model:open="batchOpen"
            :scope="scope"
            :selection="batchSelection"
            :on-synchronized="synchronize"
        />
        <Dialog v-model:open="guardedOpen">
            <DialogContent>
                <DialogTitle>{{ confirmation ? actionLabel[confirmation.kind] : '' }}</DialogTitle>
                <DialogDescription>
                    {{ confirmation?.line?.stock?.code ?? request.data.value?.title }}
                </DialogDescription>
                <template v-if="confirmation?.kind === 'execute'">
                    <p class="text-sm">
                        {{
                            request.data.value?.type === 'CONSUME'
                                ? `消耗 ${confirmation.line?.requestedQuantity} ${confirmation.line?.stock?.quantityUnit}`
                                : `整件转移至 ${confirmation.line?.destination?.path ?? '获批位置'}`
                        }}
                    </p>
                </template>
                <Field v-else>
                    <FieldLabel :for="formFieldId + '-2'">原因或意见（选填）</FieldLabel>
                    <Textarea :id="formFieldId + '-2'" v-model="reason" :disabled="store.busy" maxlength="1000" />
                </Field>
                <p v-if="store.error" role="alert" class="text-sm text-destructive">{{ store.error }}</p>
                <div class="flex justify-end gap-2">
                    <Button variant="outline" :disabled="store.busy" @click="guardedOpen = false">取消</Button>
                    <Button :disabled="locked" @click="perform">{{ store.busy ? '提交中' : '确认' }}</Button>
                </div>
            </DialogContent>
        </Dialog>
        <OverlayDraftDialog v-model:open="confirmOpen" @discard="discard" />
    </main>
</template>
