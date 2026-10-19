<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { InstanceCorrectionSchema } from '@talos-ark/contracts/inventory';
import type { InventoryStock } from '../data/source';
import { inventoryErrorMessage, useInventoryDataSource, useInventoryScope } from '../model/read';
import { HttpError } from '@/platform/http';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/ui/sheet';
import { ScrollArea } from '@/ui/scroll-area';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { SelectField } from '@/component/select-field';

const props = defineProps<{
    stock: InventoryStock;
    businessDate?: string;
    onCommitted: () => Promise<boolean>;
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
let request: AbortController | undefined;
const locked = computed(() => busy.value || committed.value || needsReload.value);
const expired = computed(
    () =>
        expiryKind.value === 'DATED' &&
        !!expiryDate.value &&
        !!props.businessDate &&
        expiryDate.value < props.businessDate
);
const sheetOpen = computed({
    get: () => open.value,
    set: (value) => {
        if (!busy.value) open.value = value;
    },
});

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
        error.value = needsReload.value
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
    try {
        const synchronized = await props.onCommitted();
        if (current !== session) return;
        syncPending.value = !synchronized;
        if (synchronized) open.value = false;
    } catch {
        if (current === session) syncPending.value = true;
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
                    <fieldset class="space-y-4 border-0 p-0" :disabled="locked">
                        <label class="grid gap-2 text-sm">
                            <span>标签</span>
                            <Input v-model="label" maxlength="200" />
                        </label>
                        <label class="grid gap-2 text-sm">
                            <span>备注</span>
                            <Textarea v-model="notes" maxlength="4000" rows="4" />
                        </label>
                        <div class="grid gap-4 sm:grid-cols-2">
                            <label class="grid gap-2 text-sm">
                                <span>生产日期</span>
                                <Input v-model="manufacturedOn" type="date" />
                            </label>
                            <label class="grid gap-2 text-sm">
                                <span>到货日期</span>
                                <Input v-model="receivedOn" type="date" />
                            </label>
                            <label class="grid gap-2 text-sm">
                                <span>开封时间（本地）</span>
                                <Input v-model="openedAt" type="datetime-local" step="1" />
                            </label>
                            <SelectField
                                v-model="expiryKind"
                                label="有效期"
                                :disabled="locked"
                                :options="[
                                    { value: 'UNKNOWN', label: '未知' },
                                    { value: 'NONE', label: '无期限' },
                                    { value: 'DATED', label: '指定日期' },
                                ]"
                            />
                            <label v-if="expiryKind === 'DATED'" class="grid gap-2 text-sm">
                                <span>有效期至</span>
                                <Input v-model="expiryDate" type="date" required />
                            </label>
                        </div>
                        <label class="grid gap-2 text-sm">
                            <span>更正原因 *</span>
                            <Textarea v-model="reason" maxlength="1000" rows="3" required />
                        </label>
                        <label v-if="expired" class="flex items-start gap-2 text-sm text-warning">
                            <input v-model="confirmExpired" type="checkbox" class="mt-1" />
                            确认该实物已超过有效期，仍保留本次资料。
                        </label>
                    </fieldset>
                    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
                    <p v-if="committed" role="status" class="text-sm text-success">
                        资料已更正。{{ syncPending ? '详情尚未同步，请只重新加载，不要重复提交。' : '' }}
                    </p>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" :disabled="busy" @click="open = false">关闭</Button>
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
</template>
