<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch, useId } from 'vue';
import { MaterialAttachmentUploadModeSchema } from '@talos-ark/contracts/material';
import { Download, File, RefreshCw, Trash2, Upload } from '@lucide/vue';
import type { MaterialAttachmentReference } from '@talos-ark/contracts/material';
import { useMaterialStore } from '../model/store';
import { useMaterialRead } from '../model/useMaterialRead';
import {
    useMaterialAttachmentStore,
    materialAttachmentAccept,
    attachmentErrorMessage,
    type MaterialAttachmentUploadMode,
} from '../model/attachment';
import { downloadFile } from '@/platform/file-transfer';
import { AuthenticationError, HttpError, isResponseValidationError } from '@/platform/http';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { Button } from '@/ui/button';
import { SelectField } from '@/component/select-field';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { Field, FieldLabel } from '@/ui/field';

const formFieldId = useId();

const props = defineProps<{ materialId: string; canManage: boolean }>();
const material = useMaterialStore();
const upload = useMaterialAttachmentStore();
const cursor = ref<string>();
const history = ref<(string | undefined)[]>([]);
const { data, loading, error, failure, reload } = useMaterialRead(
    ({ source, scope }, signal) =>
        source.attachments.list(scope, props.materialId, { limit: 30, cursor: cursor.value }, signal),
    [() => props.materialId, cursor]
);
const job = computed(() => upload.current(material.scope, props.materialId));
const busy = computed(() => !!upload.busyKey);
const active = computed(
    () =>
        material.scope &&
        upload.busyKey === `${material.scope.organizationId}/${material.scope.workspaceId}/${props.materialId}`
);
const uploadError = computed(() =>
    material.scope &&
    upload.errorKey === `${material.scope.organizationId}/${material.scope.workspaceId}/${props.materialId}`
        ? upload.error
        : ''
);
const file = shallowRef<globalThis.File>();
const uploadMode = ref<MaterialAttachmentUploadMode>('single');
const uploadModes = MaterialAttachmentUploadModeSchema.options.map((value) => ({
    value,
    label: value === 'single' ? '单次上传' : '分片上传（支持分段恢复）',
}));
const selected = shallowRef<MaterialAttachmentReference>();
const removing = shallowRef<MaterialAttachmentReference>();
const committedRemoval = ref(false);
const actionBusy = ref(false);
const actionError = ref('');
let request: AbortController | undefined;
let generation = 0;
const previewOpen = computed({
    get: () => !!selected.value,
    set: (value) => {
        if (!value) selected.value = undefined;
    },
});
const removeOpen = computed({
    get: () => !!removing.value,
    set: (value) => {
        if (!actionBusy.value && !value) removing.value = undefined;
    },
});
watch([data, error], ([value, failure]) => {
    if (!value && failure) selected.value = undefined;
});

watch(
    [() => material.scope, () => props.materialId],
    () => {
        generation++;
        request?.abort();
        file.value = selected.value = removing.value = undefined;
        cursor.value = undefined;
        history.value = [];
        actionBusy.value = committedRemoval.value = false;
        actionError.value = '';
    },
    { flush: 'sync' }
);
onScopeDispose(() => {
    generation++;
    request?.abort();
});

function size(value: string) {
    const bytes = Number(value);
    return bytes < 1024
        ? `${bytes} B`
        : bytes < 1024 * 1024
          ? `${(bytes / 1024).toFixed(1)} KiB`
          : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
function selectFile(event: Event) {
    const input = event.target as HTMLInputElement;
    file.value = input.files?.[0];
    input.value = '';
}
async function synchronize() {
    const scope = material.scope;
    const id = props.materialId;
    const current = generation;
    cursor.value = undefined;
    history.value = [];
    const synchronized = await reload();
    if (current !== generation) return false;
    if (synchronized && scope && job.value?.reference) upload.acknowledge(scope, id);
    return synchronized;
}
async function submit() {
    const scope = material.scope;
    if (!scope || !props.canManage || busy.value) return;
    const current = generation;
    await upload.run(scope, props.materialId, file.value, uploadMode.value);
    if (current !== generation) return;
    if (job.value?.reference) {
        file.value = undefined;
        cursor.value = undefined;
        history.value = [];
        await synchronize();
    }
}
async function download(attachment: MaterialAttachmentReference) {
    if (actionBusy.value) return;
    const context = material.context();
    const current = generation;
    request = new AbortController();
    const signal = AbortSignal.any([context.signal, request.signal]);
    actionBusy.value = true;
    actionError.value = '';
    try {
        const result = await context.source.attachments.download(
            context.scope,
            props.materialId,
            attachment.id,
            signal
        );
        await downloadFile(result.request, result.attachment.filename, signal);
    } catch (cause) {
        if (!signal.aborted && current === generation) {
            actionError.value = attachmentErrorMessage(cause);
            if (
                cause instanceof AuthenticationError ||
                (cause instanceof HttpError && [401, 403, 404].includes(cause.status ?? 0))
            ) {
                selected.value = undefined;
                void reload();
            }
        }
    } finally {
        if (current === generation) actionBusy.value = false;
    }
}
function confirmRemove(attachment: MaterialAttachmentReference) {
    removing.value = attachment;
    committedRemoval.value = false;
    actionError.value = '';
}
async function remove() {
    if (!removing.value || !props.canManage || actionBusy.value) return;
    const context = material.context();
    const current = generation;
    request = new AbortController();
    const signal = AbortSignal.any([context.signal, request.signal]);
    actionBusy.value = true;
    actionError.value = '';
    try {
        if (!committedRemoval.value) {
            await context.source.attachments.unbind(context.scope, props.materialId, removing.value.id, signal);
            if (signal.aborted || current !== generation) return;
            committedRemoval.value = true;
        }
        const synchronized = await reload();
        if (current !== generation) return;
        if (synchronized) {
            selected.value = undefined;
            removing.value = undefined;
        } else
            actionError.value = isResponseValidationError(failure.value)
                ? ''
                : '附件已移除，但列表尚未同步。请只重新加载。';
    } catch (cause) {
        if (!signal.aborted && current === generation) actionError.value = attachmentErrorMessage(cause);
    } finally {
        if (current === generation) actionBusy.value = false;
    }
}
function next() {
    if (!data.value?.nextCursor) return;
    history.value.push(cursor.value);
    cursor.value = data.value.nextCursor;
}
function previous() {
    if (history.value.length) cursor.value = history.value.pop();
}
</script>

<template>
    <section class="space-y-4" aria-label="材料附件">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <h2 class="font-semibold">关联文件</h2>
            <Button
                variant="outline"
                size="icon"
                use-tooltip
                tooltip="重新加载附件"
                :disabled="loading"
                @click="synchronize"
            >
                <RefreshCw />
            </Button>
        </div>
        <div v-if="canManage || job" class="space-y-3">
            <div class="flex flex-wrap items-center gap-3">
                <Field v-if="canManage && !job?.reference" class="min-w-0 flex-1">
                    <FieldLabel :for="formFieldId + '-1'" class="sr-only">
                        {{ job ? '重新选择原文件' : '选择附件' }}
                    </FieldLabel>
                    <input
                        :id="formFieldId + '-1'"
                        type="file"
                        :accept="materialAttachmentAccept"
                        :disabled="busy || !!upload.recoveryError"
                        class="max-w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2"
                        @change="selectFile"
                    />
                </Field>
                <Field v-if="canManage && !job" class="w-36 shrink-0">
                    <FieldLabel :for="formFieldId + '-mode'" class="sr-only">上传方式</FieldLabel>
                    <SelectField
                        :id="formFieldId + '-mode'"
                        v-model="uploadMode"
                        label="上传方式"
                        :options="uploadModes"
                    />
                </Field>
                <Button
                    v-if="canManage && !job?.reference"
                    :disabled="busy || (!file && !job) || !!upload.recoveryError"
                    @click="submit"
                >
                    <Upload />
                    {{ job ? '继续原上传' : '上传文件' }}
                </Button>
                <Button
                    v-if="job && !job.reference && canManage"
                    variant="outline"
                    :disabled="busy"
                    @click="material.scope && upload.cancel(material.scope, materialId)"
                >
                    取消上传
                </Button>
            </div>
            <p v-if="file" class="text-sm text-muted-foreground">{{ file.name }} · {{ size(String(file.size)) }}</p>
            <p v-if="job && !job.reference" class="text-sm text-muted-foreground">
                待处理：{{ job.input.filename }} · {{ size(String(job.input.sizeBytes)) }} ·
                {{ job.input.mode === 'multipart' ? '分片上传' : '单次上传' }}
            </p>
            <p v-if="active" role="status" class="text-sm">
                {{ upload.stage.includes('上传') ? `${upload.stage} ${upload.progress}%` : upload.stage }}
            </p>
            <p v-if="job?.reference && !isResponseValidationError(failure)" role="status" class="text-sm text-warning">
                附件已添加，列表尚未同步。
                <Button variant="link" :disabled="loading" @click="synchronize">只重新加载</Button>
            </p>
        </div>
        <div
            v-if="error || actionError || uploadError || upload.recoveryError"
            role="alert"
            class="text-sm text-destructive"
        >
            {{ actionError || upload.recoveryError || uploadError || error }}
        </div>
        <div class="overflow-x-auto rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>文件名</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>大小</TableHead>
                        <TableHead>添加时间</TableHead>
                        <TableHead class="w-24">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow v-for="item in data?.items ?? []" :key="item.id">
                        <TableCell>
                            <button
                                class="flex w-full items-center gap-2 text-left hover:underline"
                                @click="selected = item"
                            >
                                <File class="size-4 shrink-0" />
                                <span class="break-all">{{ item.filename }}</span>
                            </button>
                        </TableCell>
                        <TableCell>{{ item.contentType }}</TableCell>
                        <TableCell class="whitespace-nowrap">{{ size(item.sizeBytes) }}</TableCell>
                        <TableCell class="whitespace-nowrap">
                            {{ new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false }) }}
                        </TableCell>
                        <TableCell>
                            <div class="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    use-tooltip
                                    tooltip="下载附件"
                                    :disabled="actionBusy"
                                    @click="download(item)"
                                >
                                    <Download />
                                </Button>
                                <Button
                                    v-if="canManage"
                                    variant="ghost"
                                    size="icon"
                                    use-tooltip
                                    tooltip="移除附件"
                                    :disabled="actionBusy || busy"
                                    @click="confirmRemove(item)"
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                    <TableRow v-if="!data?.items.length">
                        <TableCell :colspan="5" class="h-32 text-center text-muted-foreground">
                            {{ loading ? '正在加载附件' : error ? '附件加载失败' : '暂无附件' }}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
        <div class="flex items-center justify-between gap-3 text-sm">
            <span class="text-muted-foreground">本批 {{ data?.items.length ?? 0 }} 项</span>
            <div class="flex gap-2">
                <Button variant="outline" size="sm" :disabled="loading || !history.length" @click="previous">
                    上一批
                </Button>
                <Button variant="outline" size="sm" :disabled="loading || !data?.nextCursor" @click="next">
                    下一批
                </Button>
            </div>
        </div>
        <SheetInspector v-model:open="previewOpen" :title="selected?.filename ?? '附件资料'" description="材料附件资料">
            <div v-if="selected" class="space-y-5 p-6">
                <CopyableId :value="selected.id" label="附件 ID" />
                <dl class="grid gap-3 text-sm">
                    <div>
                        <dt class="text-muted-foreground">类型</dt>
                        <dd>{{ selected.contentType }}</dd>
                    </div>
                    <div>
                        <dt class="text-muted-foreground">大小</dt>
                        <dd>{{ size(selected.sizeBytes) }}</dd>
                    </div>
                </dl>
                <Button :disabled="actionBusy" @click="download(selected)">
                    <Download />
                    下载文件
                </Button>
            </div>
        </SheetInspector>
        <Dialog v-model:open="removeOpen">
            <DialogContent>
                <DialogTitle>移除附件</DialogTitle>
                <DialogDescription>
                    确认从此材料移除“{{ removing?.filename }}”？移除后将无法继续下载。
                </DialogDescription>
                <p v-if="actionError" role="alert" class="text-sm text-destructive">{{ actionError }}</p>
                <div class="flex justify-end gap-2">
                    <Button variant="outline" :disabled="actionBusy" @click="removing = undefined">取消</Button>
                    <Button :disabled="actionBusy || !canManage" @click="remove">
                        {{ committedRemoval ? '只重新加载' : '确认移除' }}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    </section>
</template>
