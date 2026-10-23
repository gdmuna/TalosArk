<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch, useId } from 'vue';
import type { ApprovalScope } from '@talos-ark/contracts/approval';
import { BatchOperationPanel } from '@/component/batch-operation';
import { ScrollSurface } from '@/component/scroll-surface';
import { OverlayDraftDialog, useOverlayDraft } from '@/component/overlay-draft';
import { Button } from '@/ui/button';
import { Textarea } from '@/ui/textarea';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/ui/sheet';
import { useApprovalDataSource, approvalErrorMessage } from '../model/read';
import { useApprovalOperationStore } from '../model/operation';
import {
    prepareApprovalBatch,
    approvalBatchCommands,
    type ApprovalBatchSelection,
    type ApprovalBatchPreview,
} from '../model/batch';
import { approvalStockLabel, approvalTypeLabel } from '../model/presentation';
import { Field, FieldLabel } from '@/ui/field';
import { useWorkspaceStore } from '@/module/workspace';

const formFieldId = useId();

const props = defineProps<{
    scope: ApprovalScope | null;
    selection?: ApprovalBatchSelection;
    onSynchronized: () => Promise<boolean>;
}>();
const open = defineModel<boolean>('open', { default: false });
const source = useApprovalDataSource(),
    store = useApprovalOperationStore();
const workspace = useWorkspaceStore();
const operationWorkspace = computed(
    () =>
        workspace.workspaces.find((item) => item.id === props.scope?.workspaceId)?.name ??
        props.scope?.workspaceId ??
        '未选择工作区'
);
const key = computed(() => store.batchKey(props.scope));
const batch = computed(() => store.batch.current(key.value));
const preview = shallowRef<ApprovalBatchPreview[]>(),
    loading = ref(false),
    error = ref(''),
    note = ref('');
let request: AbortController | undefined;
const title = computed(
    () =>
        batch.value?.title ??
        (props.selection?.kind === 'execute'
            ? '批量执行获批明细'
            : props.selection?.decision === 'APPROVED'
              ? '批量批准申请'
              : '批量拒绝申请')
);
const { guardedOpen, confirmOpen, discard } = useOverlayDraft(open, () => note.value, {
    saved: () => !!batch.value,
});
async function loadPreview() {
    request?.abort();
    preview.value = undefined;
    error.value = '';
    loading.value = false;
    if (!open.value || batch.value || !props.scope || !props.selection || !source) return;
    const controller = new AbortController();
    request = controller;
    loading.value = true;
    try {
        const value = await prepareApprovalBatch(source, props.scope, props.selection, controller.signal);
        if (!controller.signal.aborted) preview.value = value;
    } catch (cause) {
        if (!controller.signal.aborted) error.value = approvalErrorMessage(cause);
    } finally {
        if (!controller.signal.aborted) loading.value = false;
    }
}
watch(
    [open, () => props.scope, () => props.selection],
    () => {
        note.value = '';
        void loadPreview();
    },
    { immediate: true }
);
watch(open, (value) => {
    if (!value) store.batch.pause();
});
watch(
    key,
    () => {
        open.value = false;
    },
    { flush: 'sync' }
);
onScopeDispose(() => {
    request?.abort();
    store.batch.pause();
});
async function synchronize() {
    await store.batch.synchronize(key.value, props.onSynchronized);
}
async function run(retry = false) {
    const current = key.value;
    await store.batch.run(current, retry);
    if (open.value && current === key.value && batch.value?.items.some((item) => item.status === 'succeeded'))
        await synchronize();
}
async function submit() {
    const scope = props.scope;
    if (!scope || !props.selection || !preview.value) return;
    const items = approvalBatchCommands(preview.value, props.selection, note.value);
    if (
        store.batch.create(
            key.value,
            title.value,
            items.map((item) => ({ ...item, input: { scope, mutation: item.mutation } }))
        )
    )
        await run();
}
</script>
<template>
    <Sheet v-model:open="guardedOpen">
        <SheetContent class="w-full gap-0 p-0 sm:max-w-4xl">
            <header class="shrink-0 space-y-2 border-b p-6 pr-12">
                <SheetTitle>{{ title }}</SheetTitle>
                <SheetDescription>
                    操作工作区 · {{ operationWorkspace }}
                    <br />
                    {{ batch ? '关闭会暂停后续提交；已提交项目保留核对记录。' : '工作区内逐项提交' }}
                </SheetDescription>
            </header>
            <ScrollSurface class="min-h-0 flex-1">
                <div class="space-y-5 p-6">
                    <BatchOperationPanel
                        v-if="batch"
                        :rows="batch.items"
                        :busy="store.batch.busy"
                        :synchronized="batch.synchronized"
                        :error="store.batch.error || batch.syncError"
                        @run="run()"
                        @retry="run(true)"
                        @synchronize="synchronize"
                        @pause="store.batch.pause()"
                        @skip="store.batch.skipPending(key)"
                        @finish="store.batch.finish(key) && (open = false)"
                    />
                    <template v-else>
                        <p v-if="loading" role="status">正在加载全部申请明细</p>
                        <div v-if="error" class="space-y-3">
                            <p role="alert" class="text-sm text-destructive">{{ error }}</p>
                            <Button variant="outline" :disabled="loading" @click="loadPreview">重新加载明细</Button>
                        </div>
                        <section v-for="group in preview" :key="group.request.id" class="space-y-3 border-b pb-5">
                            <h3 class="font-semibold">
                                {{ group.request.title }}
                                <span class="text-sm font-normal text-muted-foreground">
                                    {{ approvalTypeLabel[group.request.type] }} · {{ group.lines.length }} 件实物
                                </span>
                            </h3>
                            <p v-if="group.request.description" class="whitespace-pre-wrap text-sm">
                                {{ group.request.description }}
                            </p>
                            <ul class="divide-y">
                                <li v-for="line in group.lines" :key="line.id" class="space-y-1 py-3 text-sm">
                                    <p class="font-medium">
                                        {{ approvalStockLabel(line.stock) }}
                                    </p>
                                    <p>
                                        {{
                                            line.requestedQuantity
                                                ? `消耗 ${line.requestedQuantity} ${line.stock?.quantityUnit ?? ''}`
                                                : '整件转移'
                                        }}
                                    </p>
                                    <p class="break-words text-muted-foreground">
                                        来源：{{ line.source?.path ?? '位置受限或治理已改变' }}
                                    </p>
                                    <p
                                        v-if="group.request.type === 'TRANSFER'"
                                        class="break-words text-muted-foreground"
                                    >
                                        目标：{{ line.destination?.path ?? '位置受限或治理已改变' }}
                                    </p>
                                    <p v-if="line.note" class="whitespace-pre-wrap">{{ line.note }}</p>
                                </li>
                            </ul>
                        </section>
                        <Field v-if="selection?.kind === 'decide' && preview">
                            <FieldLabel :for="formFieldId + '-1'">整体意见（选填）</FieldLabel>
                            <Textarea :id="formFieldId + '-1'" v-model="note" maxlength="1000" />
                        </Field>
                    </template>
                </div>
            </ScrollSurface>
            <footer class="flex shrink-0 justify-end gap-2 border-t p-6">
                <Button variant="outline" @click="guardedOpen = false">关闭</Button>
                <Button
                    v-if="!batch"
                    :disabled="loading || !preview || !!store.recoveryError || store.busy"
                    @click="submit"
                >
                    确认提交 {{ selection?.kind === 'decide' ? preview?.length : preview?.[0]?.lines.length }} 项
                </Button>
            </footer>
        </SheetContent>
    </Sheet>
    <OverlayDraftDialog v-model:open="confirmOpen" @discard="discard" />
</template>
