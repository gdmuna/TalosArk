<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Eye, Plus, Package } from '@lucide/vue';
import { useRouter } from 'vue-router';
import type { StorageNodeDetail } from '@/module/facility';
import {
    useInventoryDataSource,
    useInventoryRead,
    useInventoryScope,
    useInventoryReceiptStore,
    InventoryStockInspector,
    inventoryStatusLabel,
    inventoryStatusTone,
} from '@/module/inventory';
import { Button } from '@/ui/button';
import { StateBadge } from '@/component/state-badge';
import InventoryReceiptDialog from './InventoryReceiptDialog.vue';

const props = defineProps<{ node: StorageNodeDetail }>();
const emit = defineEmits<{ changed: [] }>();
const router = useRouter();
const source = useInventoryDataSource();
const scope = useInventoryScope();
const receiptStore = useInventoryReceiptStore();
const key = computed(() => props.node.id);
const stocks = useInventoryRead(key, (currentScope, signal) =>
    source
        ? source.list(currentScope, { nodeId: props.node.id, page: 1, pageSize: 1, q: '' }, signal)
        : Promise.reject(new Error('库存数据源未连接'))
);
const context = useInventoryRead(key, (currentScope, signal) =>
    source ? source.context(currentScope, signal) : Promise.reject(new Error('库存数据源未连接'))
);
const stock = computed(() => stocks.data.value?.items[0]);
const previewId = ref('');
const receiptOpen = ref(false);
const receiptSynchronized = ref(false);
const recovering = computed(() => !!receiptStore.current(scope.value));
watch(receiptOpen, (open) => {
    if (open) {
        receiptSynchronized.value = false;
        void context.refresh();
    } else if (receiptSynchronized.value) {
        emit('changed');
    }
});
async function afterReceipt() {
    receiptSynchronized.value = await stocks.refresh();
    return receiptSynchronized.value;
}
</script>

<template>
    <section class="space-y-3 border-t pt-4" aria-label="位置库存">
        <h3 class="text-sm font-semibold">位置库存</h3>
        <p v-if="stocks.loading.value && !stocks.data.value" role="status" class="text-sm text-muted-foreground">
            正在读取位置库存
        </p>
        <div v-if="stocks.error.value || context.error.value" role="alert" class="space-y-2 text-sm">
            <p class="text-destructive">{{ stocks.error.value || context.error.value }}</p>
            <Button
                variant="outline"
                size="sm"
                @click="
                    stocks.refresh();
                    context.refresh();
                "
            >
                重新加载库存
            </Button>
        </div>
        <template v-if="stock">
            <button class="group flex w-full min-w-0 items-start gap-2 text-left" @click="previewId = stock.id">
                <Package class="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span class="min-w-0 space-y-1 text-sm">
                    <span class="block break-words font-medium group-hover:underline group-focus-visible:underline">
                        {{ stock.material.name }}
                    </span>
                    <span class="block text-xs text-muted-foreground">{{ stock.code }}</span>
                </span>
            </button>
            <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
                <StateBadge :tone="inventoryStatusTone[stock.status]">
                    {{ inventoryStatusLabel[stock.status] }}
                </StateBadge>
                <span class="tabular-nums">{{ stock.quantity }} {{ stock.quantityUnit }}</span>
            </div>
            <Button
                variant="outline"
                size="sm"
                class="w-full"
                @click="router.push(`/main/inventory/detail/${stock.id}`)"
            >
                <Eye aria-hidden="true" />
                查看库存详情
            </Button>
        </template>
        <p v-else-if="stocks.data.value && !stocks.error.value" class="text-sm text-muted-foreground">
            {{ node.occupied ? '该位置已占用，当前范围没有可访问的库存记录。' : '该位置没有库存记录。' }}
        </p>
        <Button
            v-if="node.usable || recovering"
            class="w-full"
            :disabled="
                !recovering &&
                (!context.data.value?.capabilities.receive ||
                    !!context.error.value ||
                    context.loading.value ||
                    stocks.loading.value ||
                    !!stocks.error.value ||
                    !!stock)
            "
            @click="receiptOpen = true"
        >
            <Plus aria-hidden="true" />
            {{ recovering ? '核对上次入库' : '在此登记入库' }}
        </Button>
        <InventoryStockInspector v-model:id="previewId" />
        <InventoryReceiptDialog
            v-model:open="receiptOpen"
            :scope="scope"
            :initial-position="{ facilityId: node.facilityId, topologyId: node.topologyId, nodeId: node.id }"
            :can-receive="
                !context.loading.value && !context.error.value && (context.data.value?.capabilities.receive ?? false)
            "
            :can-manage-batch="context.data.value?.capabilities.manageBatch ?? false"
            :business-date="context.data.value?.businessDate"
            :on-committed="afterReceipt"
            :sync-failure="stocks.failure.value"
            @refresh-context="context.refresh"
        />
    </section>
</template>
