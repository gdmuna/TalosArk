<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Check, MapPin, Package, Plus, Send, Trash2 } from '@lucide/vue';
import { z } from 'zod';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { ApprovalSelectionSchema, type ApprovalSelection, type ApprovalType } from '@talos-ark/contracts/approval';
import type { InventoryStock, InventoryReceipt } from '@/module/inventory';
import { useInventoryDataSource, InventoryPositionPicker } from '@/module/inventory';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { SelectField } from '@/component/select-field';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/dialog';
import { ButtonGroup } from '@/ui/button-group';
import { useApprovalRead } from '../model/read';
import { useApprovalOperationStore } from '../model/operation';
import ApprovalOperationNotice from './ApprovalOperationNotice.vue';

type Position = InventoryReceipt['position'] & { path: string };
type DraftLine = { id: string; stock: InventoryStock; quantity: string; position?: Position; note: string };
const route = useRoute(),
    router = useRouter(),
    inventory = useInventoryDataSource(),
    store = useApprovalOperationStore();
const type = ref<ApprovalType>(route.query.type === 'TRANSFER' ? 'TRANSFER' : 'CONSUME');
const rows = ref<DraftLine[]>([]),
    title = ref(''),
    description = ref(''),
    approverId = ref('');
const picker = ref(false),
    query = ref(''),
    checked = ref<string[]>([]),
    page = ref({ pageIndex: 0, pageSize: 10 });
const target = ref<DraftLine>(),
    position = ref<Position>();
const previousId = computed(() =>
    typeof route.query.previous === 'string' && z.uuid().safeParse(route.query.previous).success
        ? route.query.previous
        : undefined
);
const context = useApprovalRead(
    computed(() => 'context'),
    (source, scope, signal) => source.context(scope, signal)
);
const scope = context.scope;
const attempt = computed(() => store.current(scope.value));
const locked = computed(() => store.busy || !!attempt.value || !!store.recoveryError);
const canApply = computed(() =>
    type.value === 'CONSUME'
        ? context.data.value?.capabilities.consumeApply
        : context.data.value?.capabilities.transferApply
);
function add(stock: InventoryStock, quantity = '', destination?: Position, note = '') {
    if (!rows.value.some((row) => row.id === stock.id))
        rows.value = [...rows.value, { id: stock.id, stock, quantity, position: destination, note }];
}
const initial = useApprovalRead(
    computed(() => JSON.stringify([route.query.stock, previousId.value])),
    async (source, current, signal) => {
        if (!inventory) throw new Error('库存数据源未连接');
        if (previousId.value) {
            const original = await source.get(current, previousId.value, signal);
            const all = [];
            for (let index = 1; ; index++) {
                const result = await source.lines(current, original.id, { page: index, pageSize: 100 }, signal);
                if (!result.items.length && all.length < result.total)
                    throw new HttpError('原申请明细不完整', 'protocol');
                all.push(...result.items);
                if (all.length >= result.total) break;
            }
            const values = [];
            for (const line of all) {
                if (!line.stock) throw new Error('原申请包含无权读取的实物，请核对访问权限');
                const stock = await inventory.get(current, line.stock.stockItemId, signal);
                values.push({
                    stock,
                    quantity: line.requestedQuantity ?? '',
                    position: line.destination ?? undefined,
                    note: line.note,
                });
            }
            return { type: original.type, values };
        }
        const raw = Array.isArray(route.query.stock) ? route.query.stock : route.query.stock ? [route.query.stock] : [];
        const values = [];
        for (const id of new Set(raw)) {
            if (typeof id !== 'string' || !z.uuid().safeParse(id).success) throw new Error('库存实例编号不正确');
            values.push({
                stock: await inventory.get(current, id, signal),
                quantity: '',
                position: undefined,
                note: '',
            });
        }
        return { type: type.value, values };
    }
);
watch(initial.data, (value) => {
    if (value) {
        type.value = value.type;
        value.values.forEach((row) => add(row.stock, row.quantity, row.position, row.note));
    }
});
watch(
    scope,
    () => {
        rows.value = [];
        title.value = description.value = approverId.value = '';
        picker.value = false;
        target.value = undefined;
    },
    { flush: 'sync' }
);
const stocks = useApprovalRead(
    computed(() => (picker.value ? JSON.stringify([query.value, page.value]) : '')),
    async (_source, current, signal) => {
        if (!inventory) throw new Error('库存数据源未连接');
        return inventory.list(
            current,
            { q: query.value, page: page.value.pageIndex + 1, pageSize: page.value.pageSize },
            signal
        );
    }
);
watch(query, () => {
    page.value.pageIndex = 0;
});
const selection = computed<ApprovalSelection | undefined>(() => {
    const candidate = {
        type: type.value,
        lines: rows.value.map((row) =>
            type.value === 'CONSUME'
                ? { type: 'CONSUME', stockItemId: row.id, quantity: row.quantity, note: row.note }
                : {
                      type: 'TRANSFER',
                      stockItemId: row.id,
                      destination: row.position
                          ? {
                                facilityId: row.position.facilityId,
                                topologyId: row.position.topologyId,
                                nodeId: row.position.nodeId,
                            }
                          : undefined,
                      note: row.note,
                  }
        ),
    };
    const result = ApprovalSelectionSchema.safeParse(candidate);
    return result.success ? result.data : undefined;
});
const candidates = useApprovalRead(
    computed(() => (selection.value && canApply.value && !locked.value ? JSON.stringify(selection.value) : '')),
    (source, current, signal) => {
        if (!selection.value) throw new Error('请补全申请明细');
        return source.candidates(current, selection.value, signal);
    }
);
watch(candidates.data, (value) => {
    if (!value?.items.some((row) => row.userId === approverId.value)) approverId.value = '';
});
const columns = computed<DataTableColumn<DraftLine>[]>(() => [
    {
        id: 'code',
        label: '库存实例',
        icon: Package,
        size: 220,
        fill: true,
        sortable: false,
        value: (row) => row.stock.code,
    },
    {
        id: 'remaining',
        label: '当前余量',
        size: 150,
        sortable: false,
        value: (row) => `${row.stock.quantity} ${row.stock.quantityUnit}`,
    },
    {
        id: 'intent',
        label: type.value === 'CONSUME' ? '申请消耗量' : '目标位置',
        icon: MapPin,
        size: type.value === 'CONSUME' ? 190 : 300,
        sortable: false,
        value: (row) => (type.value === 'CONSUME' ? row.quantity : (row.position?.path ?? '选择位置')),
    },
    { id: 'note', label: '备注', size: 240, sortable: false, value: (row) => row.note },
]);
const stockColumns: DataTableColumn<InventoryStock>[] = [
    { id: 'code', label: '库存实例', size: 190, fill: true, sortable: false, value: (row) => row.code },
    { id: 'material', label: '材料', size: 200, sortable: false, value: (row) => row.material.name },
    {
        id: 'quantity',
        label: '余量',
        size: 150,
        sortable: false,
        value: (row) => `${row.quantity} ${row.quantityUnit}`,
    },
];
function pickTarget(row: DraftLine) {
    target.value = row;
    position.value = row.position;
}
function savePosition() {
    if (target.value && position.value) {
        target.value.position = position.value;
        target.value = undefined;
    }
}
async function finish() {
    const result = attempt.value?.result;
    if (result) await router.push(`/main/workbench/request/${result.receipt.requestId}`);
}
async function submit() {
    if (!scope.value || !selection.value || !approverId.value || locked.value || !canApply.value) return;
    await store.execute(scope.value, {
        kind: 'submit',
        body: {
            ...selection.value,
            approverId: approverId.value,
            title: title.value,
            description: description.value,
            previousId: previousId.value,
            idempotencyKey: crypto.randomUUID(),
        },
    });
    await finish();
}
</script>
<template>
    <main aria-label="新建申请" class="min-w-0 p-4 pt-2 lg:p-6 lg:pt-2">
        <div class="mx-auto w-full max-w-[1200px] space-y-6">
            <header class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        use-tooltip
                        aria-label="返回我的申请"
                        @click="router.push('/main/workbench/my-task?view=mine')"
                    >
                        <ArrowLeft />
                    </Button>
                    <h1 class="text-xl font-semibold">{{ previousId ? '重新申请' : '新建申请' }}</h1>
                </div>
                <Button
                    :disabled="locked || !selection || !approverId || !canApply || candidates.loading.value"
                    @click="submit"
                >
                    <Send aria-hidden="true" />
                    {{ store.busy ? '提交中' : '提交申请' }}
                </Button>
            </header>
            <ApprovalOperationNotice
                :silent="
                    !initial.error.value &&
                    !context.error.value &&
                    (isResponseValidationError(initial.failure.value) ||
                        isResponseValidationError(context.failure.value))
                "
                @synchronize="finish"
            />
            <p v-if="initial.error.value || context.error.value" role="alert" class="text-sm text-destructive">
                {{ initial.error.value || context.error.value }}
            </p>
            <fieldset :disabled="locked" class="grid gap-5 border-y py-5 sm:grid-cols-2">
                <div>
                    <label class="mb-2 block text-sm font-medium">申请类型</label>
                    <ButtonGroup aria-label="申请类型">
                        <Button
                            type="button"
                            :variant="type === 'CONSUME' ? 'secondary' : 'outline'"
                            :aria-pressed="type === 'CONSUME'"
                            :disabled="locked"
                            @click="type = 'CONSUME'"
                        >
                            消耗
                        </Button>
                        <Button
                            type="button"
                            :variant="type === 'TRANSFER' ? 'secondary' : 'outline'"
                            :aria-pressed="type === 'TRANSFER'"
                            :disabled="locked"
                            @click="type = 'TRANSFER'"
                        >
                            转移
                        </Button>
                    </ButtonGroup>
                </div>
                <label class="grid gap-2 text-sm">
                    标题（选填）
                    <Input v-model="title" placeholder="使用默认标题" maxlength="200" />
                </label>
                <label class="grid gap-2 text-sm sm:col-span-2">
                    申请说明（选填）
                    <Textarea v-model="description" maxlength="4000" />
                </label>
            </fieldset>
            <section aria-label="申请明细" class="space-y-3">
                <header class="flex items-center justify-between gap-3">
                    <h2 class="text-base font-semibold">
                        申请明细
                        <span class="ml-1 text-sm font-normal text-muted-foreground">{{ rows.length }} 件</span>
                    </h2>
                    <Button type="button" variant="outline" :disabled="locked" @click="picker = true">
                        <Plus />
                        添加实物
                    </Button>
                </header>
                <DataTable
                    :data="rows"
                    :columns="columns"
                    :filtering="false"
                    :searchable="false"
                    :actions="[
                        {
                            id: 'remove',
                            label: '移除明细',
                            icon: Trash2,
                            disabled: () => locked,
                            run: (row) => {
                                rows = rows.filter((item) => item.id !== row.id);
                            },
                        },
                    ]"
                    empty-text="尚未选择实物"
                >
                    <template #cell-code="{ row }">
                        <span class="font-medium">{{ row.stock.code }}</span>
                        <span class="mt-1 block text-xs text-muted-foreground">{{ row.stock.material.name }}</span>
                    </template>
                    <template #cell-intent="{ row }">
                        <div v-if="type === 'CONSUME'" class="flex items-center gap-2">
                            <Input
                                v-model="row.quantity"
                                :disabled="locked"
                                :aria-label="`申请消耗量 ${row.stock.code}`"
                                inputmode="decimal"
                                class="min-w-20"
                            />
                            <span class="shrink-0 text-sm text-muted-foreground">{{ row.stock.quantityUnit }}</span>
                        </div>
                        <Button
                            v-else
                            type="button"
                            variant="ghost"
                            class="h-auto min-h-9 w-full justify-start whitespace-normal text-left"
                            :disabled="locked"
                            @click="pickTarget(row)"
                        >
                            <MapPin class="shrink-0" />
                            {{ row.position?.path ?? '选择目标位置' }}
                        </Button>
                    </template>
                    <template #cell-note="{ row }">
                        <Input
                            v-model="row.note"
                            :disabled="locked"
                            :aria-label="`申请备注 ${row.stock.code}`"
                            maxlength="1000"
                        />
                    </template>
                </DataTable>
            </section>
            <section aria-label="指定审批人" class="max-w-xl space-y-3 border-t pt-5">
                <label class="block text-sm font-medium">审批人</label>
                <SelectField
                    v-model="approverId"
                    label="选择审批人"
                    :disabled="locked || !selection || candidates.loading.value"
                    :options="
                        (candidates.data.value?.items ?? []).map((row) => ({ value: row.userId, label: row.name }))
                    "
                />
                <p v-if="candidates.error.value" role="alert" class="text-sm text-destructive">
                    {{ candidates.error.value }}
                </p>
                <p
                    v-else-if="selection && !candidates.loading.value && candidates.data.value?.items.length === 0"
                    role="status"
                    class="text-sm text-muted-foreground"
                >
                    当前没有合资格审批人
                </p>
                <p v-if="context.data.value && !canApply" role="status" class="text-sm text-muted-foreground">
                    当前账户没有此动作的申请资格
                </p>
            </section>
        </div>
        <Dialog v-model:open="picker">
            <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
                <DialogTitle>添加实物</DialogTitle>
                <DialogDescription>已添加 {{ rows.length }} 件</DialogDescription>
                <p v-if="stocks.error.value" role="alert" class="text-sm text-destructive">{{ stocks.error.value }}</p>
                <DataTable
                    v-model:query="query"
                    v-model:pagination="page"
                    v-model:selected="checked"
                    :server-total="stocks.data.value?.total ?? 0"
                    :data="stocks.data.value?.items ?? []"
                    :columns="stockColumns"
                    :filtering="false"
                    :busy="stocks.loading.value"
                    :selectable="
                        (row) =>
                            !rows.some((item) => item.id === row.id) && ['IN_STOCK', 'DEPLETED'].includes(row.status)
                    "
                    :actions="[
                        {
                            id: 'add',
                            label: '添加',
                            icon: Plus,
                            disabled: (row) =>
                                rows.some((item) => item.id === row.id) ||
                                !['IN_STOCK', 'DEPLETED'].includes(row.status),
                            run: (row) => add(row),
                        },
                    ]"
                    :bulk-actions="[
                        {
                            id: 'add',
                            label: '添加所选实物',
                            icon: Plus,
                            run: (items) => items.forEach((row) => add(row)),
                        },
                    ]"
                    search-label="搜索库存实例或材料"
                />
                <div class="flex justify-end">
                    <Button type="button" @click="picker = false">
                        <Check />
                        完成选择
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        <Dialog
            :open="!!target"
            @update:open="
                (value) => {
                    if (!value) target = undefined;
                }
            "
        >
            <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogTitle>选择目标位置</DialogTitle>
                <DialogDescription>{{ target?.stock.code }}</DialogDescription>
                <InventoryPositionPicker
                    v-if="target && scope"
                    :key="target.id"
                    v-model="position"
                    :scope="scope"
                    :initial-position="target.position"
                />
                <div class="flex justify-end">
                    <Button :disabled="!position" @click="savePosition">确认位置</Button>
                </div>
            </DialogContent>
        </Dialog>
    </main>
</template>
