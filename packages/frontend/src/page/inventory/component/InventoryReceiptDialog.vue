<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch, useId } from 'vue';
import { AlertTriangle, CheckCircle2, PackagePlus } from '@lucide/vue';
import { ReceiptSchema } from '@talos-ark/contracts/inventory';
import type { MaterialBatchQuery } from '@/module/material';
import { useMaterialRead, useMaterialStore } from '@/module/material';
import { useInventoryReceiptStore } from '@/module/inventory';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { InventoryPositionPicker } from '@/module/inventory';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/ui/sheet';
import { ScrollSurface } from '@/component/scroll-surface';
import { OverlayDraftDialog, useOverlayDraft } from '@/component/overlay-draft';
import { useWorkspaceStore } from '@/module/workspace';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { SelectField } from '@/component/select-field';
import { CopyableId } from '@/component/inspector';
import type { InventoryOperationReceipt, InventoryReceipt, InventoryScope } from '@/module/inventory';
import type { ReceiptDraft } from './receipt-draft';
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/ui/field';
const standaloneFieldId = useId();

const formFieldId = useId();

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ refreshContext: [] }>();
const props = defineProps<{
    scope: InventoryScope | null;
    canReceive: boolean;
    canManageBatch: boolean;
    businessDate?: string;
    initialMaterialId?: string;
    initialBatchId?: string;
    initialPosition?: InventoryReceipt['position'];
    initialReceipt?: InventoryReceipt;
    onPrepared?: (draft: ReceiptDraft) => string | void;
    onCommitted?: (receipt: InventoryOperationReceipt) => Promise<boolean>;
    syncFailure?: unknown;
}>();

const materialStore = useMaterialStore();
const workspace = useWorkspaceStore();
const receiptStore = useInventoryReceiptStore();
const materialId = ref('');
const batchMode = ref<'none' | 'existing' | 'create'>('none');
const batchId = ref('');
const batchNumber = ref('');
const batchNotes = ref('');
const manufacturedOn = ref('');
const expiryKind = ref<'UNKNOWN' | 'NONE' | 'DATED'>('UNKNOWN');
const expiryDate = ref('');
const quantity = ref('');
const quantityUnit = ref('');
const code = ref('');
const label = ref('');
const notes = ref('');
const receivedOn = ref('');
const openedAt = ref('');
const confirmExpired = ref(false);
const selectedPosition = ref<{ facilityId: string; topologyId: string; nodeId: string; path: string }>();
const error = ref('');
const submitting = computed(() => receiptStore.busy);
const syncing = ref(false);
const attempt = computed(() => (props.onPrepared ? undefined : receiptStore.current(props.scope)));
const committed = computed(() => attempt.value?.receipt);
const pending = computed(() => (attempt.value && !attempt.value.receipt ? attempt.value : undefined));
const syncPending = ref(false);
const syncFailure = shallowRef<unknown>();
const materialSearch = ref('');
const batchSearch = ref('');
const materialPage = ref(1),
    batchPage = ref(1);
let session = 0;
const formLocked = computed(() => submitting.value || !!pending.value || !!committed.value);
const {
    guardedOpen: dialogOpen,
    confirmOpen,
    discard,
} = useOverlayDraft(
    open,
    () =>
        JSON.stringify([
            materialId.value,
            batchMode.value,
            batchId.value,
            batchNumber.value,
            batchNotes.value,
            manufacturedOn.value,
            expiryKind.value,
            expiryDate.value,
            quantity.value,
            code.value,
            label.value,
            notes.value,
            receivedOn.value,
            openedAt.value,
            confirmExpired.value,
            selectedPosition.value,
        ]),
    { busy: () => submitting.value || syncing.value, saved: () => !!attempt.value }
);

const materialKey = computed(() => JSON.stringify([open.value, props.scope, materialSearch.value, materialPage.value]));
const materials = useMaterialRead(
    (context, signal) =>
        open.value && props.scope
            ? context.source.list(
                  context.scope,
                  {
                      page: materialPage.value,
                      pageSize: 20,
                      q: materialSearch.value.trim(),
                      state: 'active',
                      sort: 'name:asc',
                  },
                  signal
              )
            : Promise.resolve(undefined),
    [materialKey]
);
const materialDetail = useMaterialRead(
    (context, signal) =>
        open.value && materialId.value
            ? context.source.get(context.scope, materialId.value, signal)
            : Promise.resolve(undefined),
    [materialId, open]
);
const selectedMaterial = computed(() => materialDetail.data.value?.material);
const materialOptions = computed(() => {
    const items = [...(materials.data.value?.items ?? [])];
    if (selectedMaterial.value && !items.some((item) => item.id === selectedMaterial.value?.id))
        items.unshift(selectedMaterial.value);
    return items.map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` }));
});
const batchRequest = computed<MaterialBatchQuery>(() => ({
    q: batchSearch.value.trim(),
    state: 'active',
    page: batchPage.value,
    pageSize: 20,
}));
const batchKey = computed(() => JSON.stringify([open.value, materialId.value, batchRequest.value]));
const batches = useMaterialRead(
    (context, signal) =>
        open.value && materialId.value
            ? context.source.listBatches(context.scope, materialId.value, batchRequest.value, signal)
            : Promise.resolve(undefined),
    [batchKey]
);
const batchDetail = useMaterialRead(
    (context, signal) =>
        open.value && materialId.value && batchMode.value === 'existing' && batchId.value
            ? context.source.getBatch(context.scope, materialId.value, batchId.value, signal)
            : Promise.resolve(undefined),
    [materialId, batchMode, batchId, open]
);
const selectedBatch = computed(() => batchDetail.data.value);
const batchOptions = computed(() => {
    const items = [...(batches.data.value?.items ?? [])];
    if (selectedBatch.value && !items.some((item) => item.id === selectedBatch.value?.id))
        items.unshift(selectedBatch.value);
    return items.map((item) => ({ value: item.id, label: item.batchNumber }));
});
const batchModes = computed(() => [
    { value: 'none', label: '不选择批次' },
    { value: 'existing', label: '选择已有批次' },
    ...(props.canManageBatch ? [{ value: 'create', label: '新建批次' }] : []),
]);
const batchLoading = computed(() => batches.loading.value);
const expiryExpired = computed(() => {
    if (expiryKind.value !== 'DATED' || !expiryDate.value) return false;
    return !!props.businessDate && expiryDate.value < props.businessDate;
});
const canSubmit = computed(
    () =>
        !!props.scope &&
        props.canReceive &&
        !receiptStore.recoveryError &&
        !receiptStore.batch.error &&
        (!!props.onPrepared ||
            (!receiptStore.batch.busy && !receiptStore.batch.current(receiptStore.batchKey(props.scope)))) &&
        !!props.businessDate &&
        !submitting.value &&
        !syncPending.value &&
        !formLocked.value &&
        !!selectedMaterial.value &&
        !selectedMaterial.value.archivedAt &&
        !materialDetail.error.value &&
        !!quantity.value &&
        !!selectedPosition.value &&
        (!expiryExpired.value || confirmExpired.value) &&
        (batchMode.value !== 'existing' ||
            (!!selectedBatch.value && !selectedBatch.value.archivedAt && !batchDetail.error.value)) &&
        (batchMode.value !== 'create' || (props.canManageBatch && !!batchNumber.value.trim()))
);

function reset() {
    materialId.value = '';
    batchMode.value = 'none';
    batchId.value = '';
    batchNumber.value = '';
    batchNotes.value = '';
    manufacturedOn.value = '';
    expiryKind.value = 'UNKNOWN';
    expiryDate.value = '';
    quantity.value = '';
    quantityUnit.value = '';
    code.value = '';
    label.value = '';
    notes.value = '';
    receivedOn.value = '';
    openedAt.value = '';
    confirmExpired.value = false;
    selectedPosition.value = undefined;
    error.value = '';
    syncing.value = false;
    syncPending.value = false;
    syncFailure.value = undefined;
    materialSearch.value = '';
    batchSearch.value = '';
    materialPage.value = batchPage.value = 1;
}

let appliedBatch = '';
watch(open, (value) => {
    if (!value) return;
    session++;
    reset();
    const body = props.initialReceipt ?? attempt.value?.body;
    if (!body) {
        materialId.value = props.initialMaterialId ?? '';
        if (materialId.value && props.initialBatchId) {
            batchMode.value = 'existing';
            batchId.value = props.initialBatchId;
        }
        return;
    }
    materialId.value = body.materialId;
    batchMode.value = body.batch.kind === 'none' ? 'none' : body.batch.kind === 'existing' ? 'existing' : 'create';
    batchId.value = body.batch.kind === 'existing' ? body.batch.id : '';
    batchNumber.value = body.batch.kind === 'create' ? body.batch.value.batchNumber : '';
    batchNotes.value = body.batch.kind === 'create' ? body.batch.value.notes : '';
    quantity.value = body.quantity;
    code.value = body.code ?? '';
    label.value = body.label;
    notes.value = body.notes;
    manufacturedOn.value = body.manufacturedOn ?? '';
    receivedOn.value = body.receivedOn ?? '';
    if (body.openedAt) {
        const date = new Date(body.openedAt);
        openedAt.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    } else openedAt.value = '';
    expiryKind.value = body.expiry.kind;
    expiryDate.value = body.expiry.kind === 'DATED' ? body.expiry.date : '';
    confirmExpired.value = body.confirmExpired;
    selectedPosition.value = body.position.nodeId ? { ...body.position, path: body.position.nodeId } : undefined;
    appliedBatch = body.batch.kind === 'existing' ? body.batch.id : '';
    error.value = receiptStore.error;
});
watch(
    [() => props.scope, () => materialStore.scope],
    ([currentScope, currentWorkspace], [previousScope, previousWorkspace]) => {
        if (!previousScope && !previousWorkspace) return;
        if (
            JSON.stringify(currentScope) === JSON.stringify(previousScope) &&
            JSON.stringify(currentWorkspace) === JSON.stringify(previousWorkspace)
        )
            return;
        session++;
        reset();
        open.value = false;
    },
    { deep: true, flush: 'sync' }
);
onScopeDispose(() => {
    session++;
});
watch(
    materialId,
    () => {
        batchMode.value = 'none';
        batchId.value = '';
        batchNumber.value = '';
        batchNotes.value = '';
        batchSearch.value = '';
        manufacturedOn.value = '';
        expiryKind.value = 'UNKNOWN';
        expiryDate.value = '';
    },
    { flush: 'sync' }
);
watch(selectedMaterial, (value) => {
    quantityUnit.value = value?.quantityUnit ?? '';
});
watch(
    [materialId, batchMode, batchId],
    () => {
        appliedBatch = '';
    },
    { flush: 'sync' }
);
watch(selectedBatch, (batch) => {
    if (!batch || batchMode.value !== 'existing' || formLocked.value || appliedBatch === batch.id) return;
    appliedBatch = batch.id;
    manufacturedOn.value = batch.manufacturedOn ?? '';
    expiryKind.value = batch.expiry.kind;
    expiryDate.value = batch.expiry.kind === 'DATED' ? batch.expiry.date : '';
});
watch(
    materialSearch,
    () => {
        materialPage.value = 1;
    },
    { flush: 'sync' }
);
watch(
    [batchSearch, materialId],
    () => {
        batchPage.value = 1;
    },
    { flush: 'sync' }
);
watch(
    [expiryKind, expiryDate],
    () => {
        confirmExpired.value = false;
    },
    { flush: 'sync' }
);
function selectedExpiry(): InventoryReceipt['expiry'] {
    if (expiryKind.value === 'DATED') return { kind: 'DATED', date: expiryDate.value };
    if (expiryKind.value === 'NONE') return { kind: 'NONE' };
    return { kind: 'UNKNOWN' };
}
function batchPayload(): InventoryReceipt['batch'] {
    if (batchMode.value === 'existing') {
        const batch = selectedBatch.value;
        return { kind: 'existing', id: batchId.value, expectedRevision: batch?.revision ?? 0 };
    }
    if (batchMode.value === 'create') {
        return {
            kind: 'create',
            value: {
                batchNumber: batchNumber.value.trim(),
                notes: batchNotes.value,
                manufacturedOn: manufacturedOn.value || null,
                expiry: selectedExpiry(),
            },
        };
    }
    return { kind: 'none' };
}
async function submit() {
    const material = selectedMaterial.value,
        position = selectedPosition.value;
    if (!canSubmit.value || !props.scope || !material || !position) return;
    error.value = '';
    const openedDate = openedAt.value ? new Date(openedAt.value) : undefined;
    if (openedDate && Number.isNaN(openedDate.getTime())) {
        error.value = '请填写有效的开封时间';
        return;
    }
    const parsed = ReceiptSchema.safeParse({
        materialId: materialId.value,
        code: code.value.trim() || undefined,
        quantity: quantity.value.trim(),
        label: label.value.trim(),
        notes: notes.value,
        manufacturedOn: manufacturedOn.value || null,
        expiry: selectedExpiry(),
        receivedOn: receivedOn.value || null,
        openedAt: openedDate?.toISOString() ?? null,
        batch: batchPayload(),
        position: selectedPosition.value
            ? {
                  facilityId: selectedPosition.value.facilityId,
                  topologyId: selectedPosition.value.topologyId,
                  nodeId: selectedPosition.value.nodeId,
              }
            : { facilityId: '', topologyId: '', nodeId: '' },
        confirmExpired: confirmExpired.value,
        idempotencyKey: `inventory-receive-${crypto.randomUUID()}`,
    });
    if (!parsed.success) {
        error.value = '请检查材料、批次、数量、日期和存储位置';
        return;
    }
    if (
        (parsed.data.quantity.split('.')[1]?.replace(/0+$/, '').length ?? 0) >
        (selectedMaterial.value?.quantityScale ?? 0)
    ) {
        error.value = `数量最多允许 ${selectedMaterial.value?.quantityScale ?? 0} 位小数`;
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
    if (props.onPrepared) {
        const failure = props.onPrepared({
            body: parsed.data,
            materialName: material.name,
            quantityUnit: material.quantityUnit,
            positionPath: position.path,
        });
        if (failure) error.value = failure;
        else open.value = false;
    } else if (receiptStore.begin(props.scope, parsed.data)) await sendPending();
}
async function sendPending() {
    if (!pending.value || !props.scope || !props.canReceive || submitting.value) return;
    const currentSession = session;
    error.value = '';
    const cause = await receiptStore.send(props.scope);
    if (currentSession !== session) return;
    if (cause instanceof HttpError && cause.code === 'INVENTORY_EXPIRY_CONFIRMATION_REQUIRED') emit('refreshContext');
    error.value = receiptStore.error;
    if (committed.value && currentSession === session) await reloadOnly();
}
async function reloadOnly() {
    if (!committed.value || syncing.value) return;
    const currentSession = session;
    syncing.value = true;
    syncFailure.value = undefined;
    try {
        const synchronized = props.onCommitted ? await props.onCommitted(committed.value) : true;
        if (currentSession === session) {
            syncPending.value = !synchronized;
            if (synchronized && props.scope) {
                if (receiptStore.acknowledge(props.scope)) open.value = false;
            }
        }
    } catch (cause) {
        if (currentSession === session) {
            syncPending.value = true;
            syncFailure.value = cause;
        }
    } finally {
        if (currentSession === session) syncing.value = false;
    }
}
</script>

<template>
    <Sheet v-model:open="dialogOpen">
        <SheetContent class="w-full gap-0 p-0 sm:max-w-2xl">
            <header class="shrink-0 space-y-2 border-b p-6 pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <PackagePlus class="size-5 text-primary" />
                    {{ onPrepared ? '编辑入库项目' : '登记入库' }}
                </SheetTitle>
                <SheetDescription>工作区 · {{ workspace.current?.name }}</SheetDescription>
            </header>
            <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
                <ScrollSurface class="min-h-0 flex-1">
                    <FieldSet class="border-0 p-6 [&_[data-slot=select-trigger]]:w-full" :disabled="formLocked">
                        <Field>
                            <FieldLabel :for="formFieldId + '-1'">搜索材料</FieldLabel>
                            <Input
                                :id="formFieldId + '-1'"
                                v-model="materialSearch"
                                placeholder="按名称、编号搜索材料"
                            />
                        </Field>
                        <div class="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel :for="standaloneFieldId + '-1'">材料</FieldLabel>
                                <SelectField
                                    :id="standaloneFieldId + '-1'"
                                    v-model="materialId"
                                    label="材料"
                                    :options="materialOptions"
                                    :disabled="formLocked"
                                />
                            </Field>
                            <Field>
                                <FieldLabel :for="formFieldId + '-2'">
                                    数量{{ quantityUnit ? `（${quantityUnit}）` : '' }}
                                </FieldLabel>
                                <Input
                                    :id="formFieldId + '-2'"
                                    v-model="quantity"
                                    inputmode="decimal"
                                    placeholder="例如 1.5"
                                    :disabled="submitting || !!committed || !materialId"
                                    required
                                />
                            </Field>
                        </div>
                        <div v-if="materials.error.value" class="text-sm text-destructive">
                            {{ materials.error.value }}
                        </div>
                        <FieldError v-if="materialDetail.error.value" role="alert" class="text-sm text-destructive">
                            {{ materialDetail.error.value }}
                        </FieldError>
                        <div class="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                :disabled="formLocked || materials.loading.value || materialPage <= 1"
                                @click="materialPage--"
                            >
                                上一页材料
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                :disabled="
                                    formLocked ||
                                    materials.loading.value ||
                                    materialPage * 20 >= (materials.data.value?.total ?? 0)
                                "
                                @click="materialPage++"
                            >
                                下一页材料
                            </Button>
                        </div>
                        <div v-if="selectedMaterial" class="rounded-md border bg-muted/20 p-3 text-sm">
                            <span class="font-medium">{{ selectedMaterial.name }}</span>
                            <span class="ml-2 text-muted-foreground">
                                精度 {{ selectedMaterial.quantityScale }} 位小数
                            </span>
                        </div>
                        <FieldSet class="rounded-md border p-4">
                            <FieldLegend class="px-1 font-medium">来源批次</FieldLegend>
                            <Field>
                                <FieldLabel :for="standaloneFieldId + '-2'">批次方式</FieldLabel>
                                <SelectField
                                    :id="standaloneFieldId + '-2'"
                                    v-model="batchMode"
                                    label="批次方式"
                                    :options="batchModes"
                                    :disabled="formLocked || !materialId"
                                />
                            </Field>
                            <Field v-if="batchMode === 'existing'">
                                <FieldLabel :for="formFieldId + '-batch-search'" class="sr-only">
                                    搜索来源批次
                                </FieldLabel>
                                <Input
                                    :id="formFieldId + '-batch-search'"
                                    v-model="batchSearch"
                                    aria-label="搜索来源批次"
                                    placeholder="搜索批号"
                                />
                            </Field>
                            <Field v-if="batchMode === 'existing'">
                                <FieldLabel :for="standaloneFieldId + '-3'">已有批次</FieldLabel>
                                <SelectField
                                    :id="standaloneFieldId + '-3'"
                                    v-model="batchId"
                                    label="已有批次"
                                    :options="batchOptions"
                                    :disabled="formLocked || batchLoading"
                                />
                            </Field>
                            <FieldError
                                v-if="batches.error.value || batchDetail.error.value"
                                role="alert"
                                class="text-sm text-destructive"
                            >
                                {{ batches.error.value || batchDetail.error.value }}
                            </FieldError>
                            <div v-if="batchMode === 'existing'" class="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    :disabled="formLocked || batchLoading || batchPage <= 1"
                                    @click="batchPage--"
                                >
                                    上一页批次
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    :disabled="
                                        formLocked || batchLoading || batchPage * 20 >= (batches.data.value?.total ?? 0)
                                    "
                                    @click="batchPage++"
                                >
                                    下一页批次
                                </Button>
                            </div>
                            <div v-if="batchMode === 'create'" class="grid gap-3 sm:grid-cols-2">
                                <Field>
                                    <FieldLabel :for="formFieldId + '-3'">批号</FieldLabel>
                                    <Input
                                        :id="formFieldId + '-3'"
                                        v-model="batchNumber"
                                        required
                                        :disabled="submitting || !!committed"
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel :for="formFieldId + '-4'">备注</FieldLabel>
                                    <Input
                                        :id="formFieldId + '-4'"
                                        v-model="batchNotes"
                                        :disabled="submitting || !!committed"
                                    />
                                </Field>
                            </div>
                        </FieldSet>
                        <div class="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel :for="formFieldId + '-5'">生产日期</FieldLabel>
                                <Input
                                    :id="formFieldId + '-5'"
                                    v-model="manufacturedOn"
                                    type="date"
                                    :disabled="submitting || !!committed"
                                />
                            </Field>
                            <Field>
                                <FieldLabel :for="formFieldId + '-6'">到货日期</FieldLabel>
                                <Input
                                    :id="formFieldId + '-6'"
                                    v-model="receivedOn"
                                    type="date"
                                    :disabled="submitting || !!committed"
                                />
                            </Field>
                            <Field>
                                <FieldLabel :for="formFieldId + '-7'">开封时间</FieldLabel>
                                <Input :id="formFieldId + '-7'" v-model="openedAt" type="datetime-local" />
                            </Field>
                            <Field>
                                <FieldLabel :for="standaloneFieldId + '-4'">有效期</FieldLabel>
                                <SelectField
                                    :id="standaloneFieldId + '-4'"
                                    v-model="expiryKind"
                                    label="有效期"
                                    :options="[
                                        { value: 'UNKNOWN', label: '未知' },
                                        { value: 'NONE', label: '无期限' },
                                        { value: 'DATED', label: '指定日期' },
                                    ]"
                                    :disabled="formLocked"
                                />
                            </Field>
                            <Field v-if="expiryKind === 'DATED'">
                                <FieldLabel :for="formFieldId + '-8'">有效期至</FieldLabel>
                                <Input
                                    :id="formFieldId + '-8'"
                                    v-model="expiryDate"
                                    type="date"
                                    required
                                    :disabled="submitting || !!committed"
                                />
                            </Field>
                        </div>
                        <Field>
                            <FieldLabel :for="formFieldId + '-9'">实例编号（可选）</FieldLabel>
                            <Input
                                :id="formFieldId + '-9'"
                                v-model="code"
                                maxlength="160"
                                placeholder="留空则由系统生成 INS- 编号"
                                :disabled="submitting || !!committed"
                            />
                        </Field>
                        <div class="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel :for="formFieldId + '-10'">标签</FieldLabel>
                                <Input
                                    :id="formFieldId + '-10'"
                                    v-model="label"
                                    maxlength="200"
                                    :disabled="submitting || !!committed"
                                />
                            </Field>
                            <Field>
                                <FieldLabel :for="formFieldId + '-11'">备注</FieldLabel>
                                <Input
                                    :id="formFieldId + '-11'"
                                    v-model="notes"
                                    maxlength="4000"
                                    :disabled="submitting || !!committed"
                                />
                            </Field>
                        </div>
                        <FieldSet class="rounded-md border p-4">
                            <FieldLegend class="px-1 font-medium">存储位置</FieldLegend>
                            <InventoryPositionPicker
                                v-if="scope && !formLocked"
                                v-model="selectedPosition"
                                :scope="scope"
                                :initial-position="
                                    initialReceipt?.position.nodeId ? initialReceipt.position : initialPosition
                                "
                            />
                            <p v-if="selectedPosition" class="text-sm text-muted-foreground">
                                已选择：{{ selectedPosition.path }}
                                <CopyableId :value="selectedPosition.nodeId" label="位置 ID" />
                            </p>
                        </FieldSet>
                        <Field
                            v-if="expiryExpired"
                            orientation="horizontal"
                            class="items-start rounded-md border border-warning/40 bg-warning-soft p-3 text-warning-soft-foreground"
                        >
                            <input
                                :id="formFieldId + '-12'"
                                v-model="confirmExpired"
                                type="checkbox"
                                class="mt-1"
                                :disabled="submitting || !!committed"
                            />
                            <FieldLabel class="font-normal" :for="formFieldId + '-12'">
                                <AlertTriangle class="mr-1 inline size-4" aria-hidden="true" />
                                该实物已超过有效期，确认仍要登记。
                            </FieldLabel>
                        </Field>
                    </FieldSet>
                </ScrollSurface>
                <footer class="shrink-0 space-y-3 border-t p-6">
                    <FieldError
                        v-if="error || receiptStore.recoveryError"
                        role="alert"
                        class="text-sm text-destructive"
                    >
                        {{ error || receiptStore.recoveryError }}
                    </FieldError>
                    <p
                        v-if="pending && !pending.responseValidationFailed && !submitting"
                        role="status"
                        class="text-sm text-warning"
                    >
                        尚未确认登记结果，草稿已锁定。重试会复用原请求编号，不会另建登记请求；请勿在其他窗口重复登记。
                    </p>
                    <div
                        v-if="committed"
                        class="space-y-2 rounded-md border border-success/40 bg-success-soft p-3 text-sm"
                    >
                        <p class="flex items-center gap-2 font-medium">
                            <CheckCircle2 class="size-4 text-success" />
                            登记已成功
                        </p>
                        <CopyableId :value="committed.operationId" label="操作 ID" />
                        <p
                            v-if="syncPending && !isResponseValidationError(syncFailure ?? props.syncFailure)"
                            class="text-warning"
                        >
                            库存列表尚未同步，请只重新加载，不要重复提交。
                        </p>
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            :disabled="submitting || syncing"
                            @click="dialogOpen = false"
                        >
                            {{ committed ? '关闭' : '取消' }}
                        </Button>
                        <Button v-if="committed" type="button" :disabled="syncing" @click="reloadOnly">
                            只重新加载
                        </Button>
                        <Button
                            v-else-if="pending"
                            type="button"
                            :disabled="submitting || !canReceive"
                            @click="sendPending"
                        >
                            {{ submitting ? '正在确认' : '重试原请求' }}
                        </Button>
                        <Button v-else-if="!committed" type="submit" :disabled="!canSubmit">
                            {{ onPrepared ? '保存至待提交清单' : submitting ? '登记中' : '登记入库' }}
                        </Button>
                    </div>
                </footer>
            </form>
        </SheetContent>
    </Sheet>
    <OverlayDraftDialog v-model:open="confirmOpen" @discard="discard" />
</template>
