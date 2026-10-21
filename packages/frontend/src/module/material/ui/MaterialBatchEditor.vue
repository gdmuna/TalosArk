<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { Plus, Save, X } from '@lucide/vue';
import { BatchWriteSchema } from '@talos-ark/contracts/material';
import type { MaterialBatch } from '../data/source';
import { useMaterialStore } from '../model/store';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/ui/sheet';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { ScrollArea } from '@/ui/scroll-area';
import { SelectField } from '@/component/select-field';

const props = defineProps<{
    materialId: string;
    batch?: MaterialBatch;
    onCommitted?: (batch: MaterialBatch) => Promise<boolean>;
    syncFailure?: unknown;
}>();
const emit = defineEmits<{ saved: [batch: MaterialBatch] }>();
const open = defineModel<boolean>('open', { default: false });
const store = useMaterialStore();
const batchNumber = ref('');
const notes = ref('');
const manufacturedOn = ref('');
const expiryKind = ref<'UNKNOWN' | 'NONE' | 'DATED'>('UNKNOWN');
const expiryDate = ref('');
const validation = ref('');
const syncPending = ref(false);
const syncFailure = ref<unknown>();
const committed = ref<MaterialBatch>();
const initial = ref<MaterialBatch>();
const syncing = ref(false);
const needsReload = ref(false);
const locked = computed(() => store.busy || syncing.value || needsReload.value || !!committed.value);
const session = ref(0);
onScopeDispose(() => {
    session.value++;
});
const sheetOpen = computed({
    get: () => open.value,
    set: (value) => {
        if (!store.busy && !syncing.value) open.value = value;
    },
});

function reset() {
    session.value++;
    const batch = initial.value;
    batchNumber.value = batch?.batchNumber ?? '';
    notes.value = batch?.notes ?? '';
    manufacturedOn.value = batch?.manufacturedOn ?? '';
    expiryKind.value = batch?.expiry.kind ?? 'UNKNOWN';
    expiryDate.value = batch?.expiry.kind === 'DATED' ? batch.expiry.date : '';
    validation.value = '';
    syncing.value = false;
    syncPending.value = false;
    syncFailure.value = undefined;
    committed.value = undefined;
    needsReload.value = false;
    store.error = '';
}

watch(open, (value) => {
    if (value) {
        initial.value = props.batch;
        reset();
    }
});
watch(
    [() => store.scope, () => props.materialId],
    () => {
        session.value++;
        open.value = false;
    },
    { flush: 'sync' }
);

function expiry() {
    if (expiryKind.value === 'DATED') return { kind: 'DATED' as const, date: expiryDate.value };
    if (expiryKind.value === 'NONE') return { kind: 'NONE' as const };
    return { kind: 'UNKNOWN' as const };
}

async function submit() {
    if (locked.value || initial.value?.archivedAt) return;
    const currentSession = session.value;
    const batch = initial.value;
    validation.value = '';
    const base = {
        batchNumber: batchNumber.value.trim(),
        notes: notes.value,
        manufacturedOn: manufacturedOn.value || null,
        expiry: expiry(),
    };
    const parsed = BatchWriteSchema.safeParse(base);
    if (!parsed.success) {
        validation.value = '请填写有效的批号、日期和有效期';
        return;
    }
    if (
        parsed.data.manufacturedOn &&
        parsed.data.expiry.kind === 'DATED' &&
        parsed.data.expiry.date < parsed.data.manufacturedOn
    ) {
        validation.value = '生产日期不能晚于有效期';
        return;
    }
    const result = await store.mutate(({ source, scope, signal }) =>
        batch
            ? source.updateBatch(
                  scope,
                  props.materialId,
                  batch.id,
                  { ...parsed.data, expectedRevision: batch.revision },
                  signal
              )
            : source.createBatch(scope, props.materialId, parsed.data, signal)
    );
    if (currentSession !== session.value) return;
    if (!result) {
        const cause = store.failure;
        needsReload.value =
            !!cause &&
            (!(cause instanceof HttpError) ||
                cause.status === 409 ||
                cause.kind === 'protocol' ||
                !cause.response ||
                (cause.status ?? 500) >= 500);
        return;
    }
    committed.value = result;
    emit('saved', result);
    await reloadOnly();
}

async function reloadDraft() {
    if (store.busy || syncing.value) return;
    const currentSession = session.value;
    const context = store.context();
    syncing.value = true;
    validation.value = '';
    try {
        let batch: MaterialBatch | undefined;
        if (initial.value) {
            batch = await context.source.getBatch(context.scope, props.materialId, initial.value.id, context.signal);
        } else {
            const page = await context.source.listBatches(
                context.scope,
                props.materialId,
                { q: batchNumber.value.trim(), state: 'all', page: 1, pageSize: 100 },
                context.signal
            );
            batch = page.items.find((item) => item.batchNumber === batchNumber.value.trim());
            if (!batch && page.total > page.items.length) {
                throw new Error('请先在批次列表中核对原批号，确认登记结果。');
            }
        }
        if (context.signal.aborted || currentSession !== session.value) return;
        if (batch) {
            initial.value = batch;
            reset();
            validation.value = '已读取当前批次资料，请核对后再操作。';
        } else {
            needsReload.value = false;
            store.error = '';
            validation.value = '当前未找到同批号记录，可以核对表单后重新提交。';
        }
    } catch (cause) {
        if (!context.signal.aborted && currentSession === session.value)
            validation.value = isResponseValidationError(cause)
                ? ''
                : cause instanceof Error
                  ? cause.message
                  : '读取批次失败';
    } finally {
        if (currentSession === session.value) syncing.value = false;
    }
}

async function reloadOnly() {
    if (!committed.value || syncing.value) return;
    const currentSession = session.value;
    syncing.value = true;
    syncFailure.value = undefined;
    try {
        const synchronized = props.onCommitted ? await props.onCommitted(committed.value) : true;
        if (currentSession !== session.value) return;
        syncPending.value = !synchronized;
        if (synchronized) open.value = false;
    } catch (cause) {
        if (currentSession === session.value) {
            syncPending.value = true;
            syncFailure.value = cause;
        }
    } finally {
        if (currentSession === session.value) syncing.value = false;
    }
}
</script>

<template>
    <Sheet v-model:open="sheetOpen">
        <SheetContent
            class="w-full gap-0 p-0 sm:max-w-xl"
            @interact-outside="(event) => (store.busy || syncing) && event.preventDefault()"
            @escape-key-down="(event) => (store.busy || syncing) && event.preventDefault()"
        >
            <div class="shrink-0 border-b p-6 pr-12">
                <SheetTitle>{{ initial ? '编辑批次' : '新建批次' }}</SheetTitle>
                <SheetDescription class="sr-only">材料来源批次资料</SheetDescription>
            </div>
            <ScrollArea class="min-h-0 flex-1">
                <form class="space-y-5 p-6" @submit.prevent="submit">
                    <label class="grid gap-2 text-sm">
                        <span>批号 *</span>
                        <Input v-model="batchNumber" maxlength="160" required :disabled="locked" />
                    </label>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <label class="grid gap-2 text-sm">
                            <span>生产日期</span>
                            <Input v-model="manufacturedOn" type="date" :disabled="locked" />
                        </label>
                        <label class="grid gap-2 text-sm">
                            <span>有效期</span>
                            <SelectField
                                v-model="expiryKind"
                                label="有效期"
                                :options="[
                                    { value: 'UNKNOWN', label: '未知' },
                                    { value: 'NONE', label: '无期限' },
                                    { value: 'DATED', label: '指定日期' },
                                ]"
                                :disabled="locked"
                            />
                        </label>
                    </div>
                    <label v-if="expiryKind === 'DATED'" class="grid gap-2 text-sm">
                        <span>有效期至</span>
                        <Input v-model="expiryDate" type="date" required :disabled="locked" />
                    </label>
                    <label class="grid gap-2 text-sm">
                        <span>备注</span>
                        <Textarea v-model="notes" rows="5" maxlength="4000" :disabled="locked" />
                    </label>
                    <p v-if="validation || store.error" role="alert" class="text-sm text-destructive">
                        {{ validation || store.error }}
                    </p>
                    <div v-if="committed" class="rounded-md border border-success/40 bg-success-soft p-3 text-sm">
                        <p class="font-medium">批次已保存</p>
                        <p
                            v-if="syncPending && !isResponseValidationError(syncFailure ?? props.syncFailure)"
                            class="mt-1 text-warning"
                        >
                            列表尚未同步，请只重新加载，不要重复提交。
                        </p>
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" :disabled="store.busy || syncing" @click="open = false">
                            <X aria-hidden="true" />
                            {{ committed ? '关闭' : '取消' }}
                        </Button>
                        <Button v-if="syncPending" type="button" :disabled="syncing" @click="reloadOnly">
                            只重新加载
                        </Button>
                        <Button v-else-if="needsReload" type="button" :disabled="syncing" @click="reloadDraft">
                            读取最新资料
                        </Button>
                        <Button v-else-if="!committed" type="submit" :disabled="locked">
                            <component :is="initial ? Save : Plus" aria-hidden="true" />
                            {{ initial ? '保存批次' : '新建批次' }}
                        </Button>
                    </div>
                </form>
            </ScrollArea>
        </SheetContent>
    </Sheet>
</template>
