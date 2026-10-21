<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { InventoryActionSchema } from '@talos-ark/contracts/inventory';
import { isResponseValidationError } from '@/platform/http';
import {
    inventoryActionLabel,
    inventoryErrorMessage,
    useInventoryActionStore,
    useInventoryDataSource,
    type InventoryActionKind,
    type InventoryOperationReceipt,
    type InventoryScope,
    type InventoryStock,
} from '@/module/inventory';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/dialog';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Checkbox } from '@/ui/checkbox';
import { InventoryPositionPicker } from '@/module/inventory';

const props = defineProps<{
    scope: InventoryScope | null;
    stock?: InventoryStock;
    kind?: InventoryActionKind;
    onCommitted: (receipt: InventoryOperationReceipt) => Promise<boolean>;
    syncFailure?: unknown;
}>();
const open = defineModel<boolean>('open', { default: false });
const silentSync = ref(false);
const source = useInventoryDataSource();
const store = useInventoryActionStore();
const stock = shallowRef<InventoryStock>();
const quantity = ref('');
const reason = ref('');
const confirmed = ref(false);
const positionRevision = ref(0);
const position = ref<{ facilityId: string; topologyId: string; nodeId: string; path: string }>();
const loading = ref(false),
    syncing = ref(false),
    needsReload = ref(false);
const error = ref(''),
    syncError = ref('');
let lifetime = new AbortController();
const attempt = computed(() => store.current(props.scope));
const kind = computed(() => attempt.value?.command.kind ?? props.kind);
const title = computed(() => (kind.value ? inventoryActionLabel[kind.value] : '核对库存操作'));
const locked = computed(() => store.busy || syncing.value || loading.value);
const dialogOpen = computed({
    get: () => open.value,
    set: (value) => {
        if (!store.busy && !syncing.value) open.value = value;
    },
});
const canSubmit = computed(
    () =>
        !!stock.value &&
        !!kind.value &&
        !!stock.value.actions[kind.value] &&
        !attempt.value &&
        !locked.value &&
        !needsReload.value &&
        !store.recoveryError
);

watch(
    () => props.scope,
    () => {
        open.value = false;
    },
    { flush: 'sync' }
);
watch(
    open,
    () => {
        lifetime.abort();
        lifetime = new AbortController();
        stock.value = undefined;
        error.value = syncError.value = '';
        silentSync.value = false;
        loading.value = syncing.value = needsReload.value = false;
        reason.value = quantity.value = '';
        position.value = undefined;
        confirmed.value = false;
        if (open.value) {
            store.error = '';
            if (!attempt.value) void reloadStock();
        }
    },
    { flush: 'sync' }
);
onScopeDispose(() => lifetime.abort());

async function reloadStock() {
    if (!source || !props.scope || !props.stock || loading.value) return;
    const signal = lifetime.signal;
    loading.value = true;
    error.value = '';
    confirmed.value = false;
    position.value = undefined;
    positionRevision.value++;
    try {
        const latest = await source.get(props.scope, props.stock.id, signal);
        if (signal.aborted) return;
        stock.value = latest;
        needsReload.value = false;
        if (!quantity.value && props.kind === 'adjust') quantity.value = latest.quantity;
    } catch (cause) {
        if (!signal.aborted) {
            needsReload.value = true;
            error.value = inventoryErrorMessage(cause);
        }
    } finally {
        if (!signal.aborted) loading.value = false;
    }
}
async function submit() {
    if (!canSubmit.value || !props.scope || !stock.value || !kind.value) return;
    error.value = store.error = '';
    if (kind.value === 'dispose' && !confirmed.value) {
        error.value = '请确认结束库存管理并释放占位。';
        return;
    }
    const base = { expectedVersion: stock.value.version, idempotencyKey: crypto.randomUUID(), reason: reason.value };
    const parsed = InventoryActionSchema.safeParse({
        kind: kind.value,
        body: {
            ...base,
            ...(kind.value === 'consume' ? { quantity: quantity.value.trim() } : {}),
            ...(kind.value === 'adjust' ? { actualQuantity: quantity.value.trim() } : {}),
            ...(kind.value === 'transfer'
                ? {
                      position: position.value
                          ? {
                                facilityId: position.value.facilityId,
                                topologyId: position.value.topologyId,
                                nodeId: position.value.nodeId,
                            }
                          : undefined,
                  }
                : {}),
        },
    });
    if (!parsed.success || (quantity.value.split('.')[1]?.replace(/0+$/, '').length ?? 0) > stock.value.quantityScale) {
        error.value =
            kind.value === 'transfer'
                ? '请选择一个可用的空位置。'
                : `请填写有效数量，最多 ${stock.value.quantityScale} 位小数；消耗量必须大于 0。`;
        return;
    }
    const signal = lifetime.signal;
    await store.execute(props.scope, stock.value, parsed.data);
    if (signal.aborted) return;
    if (attempt.value?.receipt) await synchronize();
    else if (!attempt.value) needsReload.value = true;
}
async function recover() {
    if (!props.scope) return;
    const signal = lifetime.signal;
    const recovered = await store.recover(props.scope);
    if (!signal.aborted && recovered && attempt.value?.receipt) await synchronize();
}
async function synchronize() {
    const saved = attempt.value;
    if (!source || !saved?.receipt || syncing.value) return;
    const signal = lifetime.signal;
    syncing.value = true;
    syncError.value = '';
    silentSync.value = false;
    try {
        await source.get(saved.scope, saved.stockItemId, signal);
        await source.transactions(
            saved.scope,
            {
                page: 1,
                pageSize: 10,
                q: '',
                stockItemId: saved.stockItemId,
                operationId: saved.receipt.operationId,
            },
            signal
        );
        if (signal.aborted) return;
        const ready = await props.onCommitted(saved.receipt);
        if (signal.aborted) return;
        if (!ready) {
            silentSync.value = isResponseValidationError(props.syncFailure);
            syncError.value = isResponseValidationError(props.syncFailure)
                ? ''
                : '操作已成功，页面尚未同步。请只重新加载。';
        } else if (store.acknowledge(saved.scope)) open.value = false;
    } catch (cause) {
        if (!signal.aborted) {
            silentSync.value = isResponseValidationError(cause);
            syncError.value = isResponseValidationError(cause) ? '' : '操作已成功，页面尚未同步。请只重新加载。';
        }
    } finally {
        if (!signal.aborted) syncing.value = false;
    }
}
</script>

<template>
    <Dialog v-model:open="dialogOpen">
        <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogTitle>{{ title }}</DialogTitle>
            <DialogDescription>
                {{ attempt?.code ?? stock?.code ?? props.stock?.code ?? '恢复上次提交的库存操作' }}
            </DialogDescription>
            <p v-if="store.recoveryError || error || store.error" role="alert" class="text-sm text-destructive">
                {{ store.recoveryError || error || store.error }}
            </p>
            <template v-if="attempt">
                <div
                    v-if="!attempt.responseValidationFailed && !silentSync"
                    role="status"
                    class="space-y-2 border-y py-4 text-sm"
                >
                    <p class="font-medium">{{ attempt.receipt ? '操作已成功' : '原操作结果尚未确认' }}</p>
                    <p class="text-muted-foreground">
                        {{
                            attempt.receipt
                                ? '库存事实已提交，当前只需同步页面。'
                                : '继续核对将使用保存的原请求，避免重复变更库存。'
                        }}
                    </p>
                </div>
                <p v-if="syncError" class="text-destructive">{{ syncError }}</p>
                <div class="flex justify-end gap-2">
                    <Button variant="outline" :disabled="locked" @click="open = false">关闭</Button>
                    <Button :disabled="locked" @click="attempt.receipt ? synchronize() : recover()">
                        {{ locked ? '正在核对' : attempt.receipt ? '只重新加载' : '继续核对原操作' }}
                    </Button>
                </div>
            </template>
            <form v-else class="space-y-5" @submit.prevent="submit">
                <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在核对当前库存</p>
                <template v-if="stock">
                    <dl class="grid grid-cols-2 gap-3 border-y py-4 text-sm">
                        <div>
                            <dt class="text-muted-foreground">材料</dt>
                            <dd class="mt-1 break-words">{{ stock.material.name }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">当前余量</dt>
                            <dd class="mt-1 tabular-nums">{{ stock.quantity }} {{ stock.quantityUnit }}</dd>
                        </div>
                    </dl>
                    <fieldset :disabled="locked || needsReload" class="space-y-4">
                        <label v-if="kind === 'consume' || kind === 'adjust'" class="grid gap-2 text-sm">
                            {{ kind === 'consume' ? '本次实际消耗量' : '核实后的实际剩余量' }}（{{
                                stock.quantityUnit
                            }}）
                            <Input v-model="quantity" inputmode="decimal" autocomplete="off" required />
                        </label>
                        <InventoryPositionPicker
                            v-if="kind === 'transfer' && scope"
                            :key="positionRevision"
                            v-model="position"
                            :scope="scope"
                        />
                        <template v-if="kind === 'dispose'">
                            <p class="text-sm leading-6 text-muted-foreground">
                                本件实物将结束库存管理，账面余量归零并释放存放位置；保留实物资料和历史。这不代表现实中的销毁程序已完成。
                            </p>
                            <label class="flex items-start gap-3 text-sm">
                                <Checkbox v-model="confirmed" class="mt-0.5" />
                                <span>确认移出管理并释放占位</span>
                            </label>
                        </template>
                        <label class="grid gap-2 text-sm">
                            原因或备注（选填）
                            <Textarea v-model="reason" maxlength="1000" />
                        </label>
                    </fieldset>
                    <p v-if="kind && !stock.actions[kind]" role="status" class="text-sm text-muted-foreground">
                        当前权限或实物、存储状态不允许此操作。
                    </p>
                </template>
                <div class="flex justify-end gap-2 border-t pt-4">
                    <Button type="button" variant="outline" :disabled="locked" @click="open = false">取消</Button>
                    <Button
                        v-if="needsReload || (!stock && !loading)"
                        type="button"
                        variant="outline"
                        :disabled="locked"
                        @click="reloadStock"
                    >
                        加载最新库存
                    </Button>
                    <Button
                        :disabled="!canSubmit || (kind === 'dispose' && !confirmed)"
                        :variant="kind === 'dispose' ? 'destructive' : 'default'"
                    >
                        {{ store.busy ? '提交中' : title }}
                    </Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
