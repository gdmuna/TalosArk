<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch, useId } from 'vue';
import { InstanceCorrectionSchema } from '@talos-ark/contracts/inventory';
import type { InventoryStock } from '../data/source';
import { inventoryErrorMessage, useInventoryDataSource, useInventoryScope } from '../model/read';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/ui/sheet';
import { ScrollArea } from '@/ui/scroll-area';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/checkbox';
import { Textarea } from '@/ui/textarea';
import { SelectField } from '@/component/select-field';
import { OverlayDraftDialog, useOverlayDraft } from '@/component/overlay-draft';
import { Field, FieldError, FieldLabel, FieldSet } from '@/ui/field';
const standaloneFieldId = useId();

const formFieldId = useId();

const props = defineProps<{
    stock: InventoryStock;
    businessDate?: string;
    onCommitted: () => Promise<boolean>;
    syncFailure?: unknown;
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ refreshContext: [] }>();
const source = useInventoryDataSource();
const scope = useInventoryScope();
const initial = shallowRef<InventoryStock>();
const label = ref(''),
    notes = ref(''),
    manufacturedOn = ref(''),
    receivedOn = ref(''),
    openedAt = ref('');
const expiryKind = ref<'UNKNOWN' | 'NONE' | 'DATED'>('UNKNOWN'),
    expiryDate = ref('');
const reason = ref(''),
    error = ref('');
const confirmExpired = ref(false),
    busy = ref(false),
    committed = ref(false),
    syncPending = ref(false),
    needsReload = ref(false);
let session = 0;
const syncFailure = shallowRef<unknown>();
let request: AbortController | undefined;
const locked = computed(() => busy.value || committed.value || needsReload.value);
const expired = computed(
    () =>
        expiryKind.value === 'DATED' &&
        !!expiryDate.value &&
        !!props.businessDate &&
        expiryDate.value < props.businessDate
);
const {
    guardedOpen: sheetOpen,
    confirmOpen,
    discard,
    markClean,
} = useOverlayDraft(
    open,
    () =>
        JSON.stringify([
            label.value,
            notes.value,
            manufacturedOn.value,
            receivedOn.value,
            openedAt.value,
            expiryKind.value,
            expiryDate.value,
            reason.value,
            confirmExpired.value,
        ]),
    { busy, saved: committed }
);

function localOpenedAt(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}
function reset(stock: InventoryStock) {
    initial.value = stock;
    label.value = stock.label;
    notes.value = stock.notes;
    manufacturedOn.value = stock.manufacturedOn ?? '';
    receivedOn.value = stock.receivedOn ?? '';
    openedAt.value = localOpenedAt(stock.openedAt);
    expiryKind.value = stock.expiry.kind;
    expiryDate.value = stock.expiry.kind === 'DATED' ? stock.expiry.date : '';
    reason.value = error.value = '';
    confirmExpired.value = committed.value = syncPending.value = needsReload.value = false;
    syncFailure.value = undefined;
    markClean();
}
watch(open, (value) => {
    if (value) {
        session++;
        reset(props.stock);
    }
});
watch(
    [scope, () => props.stock.id],
    () => {
        session++;
        request?.abort();
        busy.value = false;
        open.value = false;
    },
    { flush: 'sync' }
);
onScopeDispose(() => {
    session++;
    request?.abort();
});

async function submit() {
    const stock = initial.value,
        currentScope = scope.value;
    if (!source || !stock || !currentScope || !stock.capabilities.updateFacts || !props.businessDate || locked.value)
        return;
    error.value = '';
    const date = openedAt.value ? new Date(openedAt.value) : undefined;
    if (date && Number.isNaN(date.getTime())) {
        error.value = '请填写有效的开封时间';
        return;
    }
    const parsed = InstanceCorrectionSchema.safeParse({
        label: label.value,
        notes: notes.value,
        manufacturedOn: manufacturedOn.value || null,
        receivedOn: receivedOn.value || null,
        openedAt: openedAt.value === localOpenedAt(stock.openedAt) ? stock.openedAt : (date?.toISOString() ?? null),
        expiry: expiryKind.value === 'DATED' ? { kind: 'DATED', date: expiryDate.value } : { kind: expiryKind.value },
        expectedRevision: stock.revision,
        reason: reason.value.trim(),
        confirmExpired: confirmExpired.value,
    });
    if (!parsed.success) {
        error.value = '请填写更正原因，并检查日期及资料长度';
        return;
    }
    if (
        parsed.data.manufacturedOn &&
        parsed.data.expiry.kind === 'DATED' &&
        parsed.data.expiry.date < parsed.data.manufacturedOn
    ) {
        error.value = '生产日期不能晚于有效期';
        return;
    }
    const current = session;
    request = new AbortController();
    const signal = request.signal;
    busy.value = true;
    try {
        await source.correct(currentScope, stock.id, parsed.data, signal);
        if (signal.aborted || current !== session) return;
        committed.value = true;
    } catch (cause) {
        if (signal.aborted || current !== session) return;
        if (cause instanceof HttpError && cause.code === 'INVENTORY_EXPIRY_CONFIRMATION_REQUIRED')
            emit('refreshContext');
        needsReload.value =
            !(cause instanceof HttpError) ||
            cause.status === 409 ||
            !cause.response ||
            cause.kind === 'protocol' ||
            (cause.status ?? 500) >= 500;
        error.value = isResponseValidationError(cause)
            ? ''
            : needsReload.value
              ? '资料可能已改变或写入结果无法确认，请重新加载并核对后再操作。'
              : inventoryErrorMessage(cause);
    } finally {
        if (current === session) busy.value = false;
    }
    if (committed.value && current === session) await reloadOnly();
}
async function reloadOnly() {
    if (!committed.value || busy.value) return;
    const current = session;
    busy.value = true;
    syncFailure.value = undefined;
    try {
        const synchronized = await props.onCommitted();
        if (current !== session) return;
        syncPending.value = !synchronized;
        if (synchronized) open.value = false;
    } catch (cause) {
        if (current === session) {
            syncPending.value = true;
            syncFailure.value = cause;
        }
    } finally {
        if (current === session) busy.value = false;
    }
}
async function reloadDraft() {
    if (!source || !scope.value || busy.value) return;
    const current = session;
    request = new AbortController();
    const signal = request.signal;
    busy.value = true;
    try {
        const stock = await source.get(scope.value, props.stock.id, signal);
        if (!signal.aborted && current === session) reset(stock);
    } catch (cause) {
        if (!signal.aborted && current === session) error.value = inventoryErrorMessage(cause);
    } finally {
        if (current === session) busy.value = false;
    }
}
</script>

<template>
    <Sheet v-model:open="sheetOpen">
        <SheetContent class="w-full gap-0 p-0 sm:max-w-xl">
            <div class="shrink-0 border-b p-6 pr-12">
                <SheetTitle>更正实例资料</SheetTitle>
                <SheetDescription>{{ stock.code }} · {{ stock.material.name }}</SheetDescription>
            </div>
            <ScrollArea class="min-h-0 flex-1">
                <form class="space-y-5 p-6" @submit.prevent="submit">
                    <FieldSet class="border-0 p-0" :disabled="locked">
                        <Field>
                            <FieldLabel :for="formFieldId + '-1'">标签</FieldLabel>
                            <Input :id="formFieldId + '-1'" v-model="label" maxlength="200" />
                        </Field>
                        <Field>
                            <FieldLabel :for="formFieldId + '-2'">备注</FieldLabel>
                            <Textarea :id="formFieldId + '-2'" v-model="notes" maxlength="4000" rows="4" />
                        </Field>
                        <div class="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel :for="formFieldId + '-3'">生产日期</FieldLabel>
                                <Input :id="formFieldId + '-3'" v-model="manufacturedOn" type="date" />
                            </Field>
                            <Field>
                                <FieldLabel :for="formFieldId + '-4'">到货日期</FieldLabel>
                                <Input :id="formFieldId + '-4'" v-model="receivedOn" type="date" />
                            </Field>
                            <Field>
                                <FieldLabel :for="formFieldId + '-5'">开封时间（本地）</FieldLabel>
                                <Input :id="formFieldId + '-5'" v-model="openedAt" type="datetime-local" step="1" />
                            </Field>
                            <Field>
                                <FieldLabel :for="standaloneFieldId + '-1'">有效期</FieldLabel>
                                <SelectField
                                    :id="standaloneFieldId + '-1'"
                                    v-model="expiryKind"
                                    label="有效期"
                                    :disabled="locked"
                                    :options="[
                                        { value: 'UNKNOWN', label: '未知' },
                                        { value: 'NONE', label: '无期限' },
                                        { value: 'DATED', label: '指定日期' },
                                    ]"
                                />
                            </Field>
                            <Field v-if="expiryKind === 'DATED'">
                                <FieldLabel :for="formFieldId + '-6'">有效期至</FieldLabel>
                                <Input :id="formFieldId + '-6'" v-model="expiryDate" type="date" required />
                            </Field>
                        </div>
                        <Field>
                            <FieldLabel :for="formFieldId + '-7'">更正原因 *</FieldLabel>
                            <Textarea :id="formFieldId + '-7'" v-model="reason" maxlength="1000" rows="3" required />
                        </Field>
                        <Field v-if="expired" orientation="horizontal" class="items-start text-warning">
                            <Checkbox
                                :id="formFieldId + '-8'"
                                :model-value="confirmExpired"
                                :disabled="locked"
                                @update:model-value="confirmExpired = $event === true"
                            />
                            <FieldLabel :for="formFieldId + '-8'" class="font-normal">
                                确认该实物已超过有效期，仍保留本次资料。
                            </FieldLabel>
                        </Field>
                    </FieldSet>
                    <FieldError v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</FieldError>
                    <p v-if="committed" role="status" class="text-sm text-success">
                        资料已更正。{{
                            syncPending && !isResponseValidationError(syncFailure ?? props.syncFailure)
                                ? '详情尚未同步，请只重新加载，不要重复提交。'
                                : ''
                        }}
                    </p>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" :disabled="busy" @click="sheetOpen = false">
                            关闭
                        </Button>
                        <Button v-if="needsReload" type="button" :disabled="busy" @click="reloadDraft">
                            重新加载资料
                        </Button>
                        <Button v-else-if="syncPending" type="button" :disabled="busy" @click="reloadOnly">
                            只重新加载
                        </Button>
                        <Button
                            v-else-if="!committed"
                            type="submit"
                            :disabled="
                                locked ||
                                !businessDate ||
                                !initial?.capabilities.updateFacts ||
                                (expired && !confirmExpired)
                            "
                        >
                            {{ busy ? '正在保存' : '确认更正' }}
                        </Button>
                    </div>
                </form>
            </ScrollArea>
        </SheetContent>
    </Sheet>
    <OverlayDraftDialog v-model:open="confirmOpen" @discard="discard" />
</template>
