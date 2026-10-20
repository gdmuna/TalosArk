<script setup lang="ts">
import { computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowUpRight, Package } from '@lucide/vue';
import { useInventoryDataSource, useInventoryRead } from '../model/read';
import { inventoryStatusLabel, inventoryStatusTone, inventoryExpiryLabel } from '../model/presentation';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { StateBadge } from '@/component/state-badge';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';

const id = defineModel<string>('id', { default: '' });
const source = useInventoryDataSource();
const { data, loading, error, refresh, scope } = useInventoryRead(id, (currentScope, signal) => {
    if (!source) return Promise.reject(new Error('库存数据源未连接'));
    return source.get(currentScope, id.value, signal);
});
const open = computed({
    get: () => !!id.value,
    set: (value) => {
        if (!value) id.value = '';
    },
});
watch(
    scope,
    () => {
        id.value = '';
    },
    { flush: 'sync' }
);
const facts = computed(() =>
    data.value
        ? [
              { label: '材料', value: data.value.material.name },
              { label: '来源批次', value: data.value.batch?.batchNumber ?? '未关联' },
              { label: '当前数量', value: `${data.value.quantity} ${data.value.quantityUnit}` },
              {
                  label: '有效期',
                  value:
                      data.value.expiry.kind === 'DATED'
                          ? data.value.expiry.date
                          : inventoryExpiryLabel[data.value.expiryRisk],
              },
              {
                  label: '存储位置',
                  value: data.value.location?.path ?? (data.value.locationRestricted ? '位置受限' : '未分配'),
              },
              { label: '入库时间', value: new Date(data.value.createdAt).toLocaleString('zh-CN', { hour12: false }) },
          ]
        : []
);
</script>

<template>
    <SheetInspector v-model:open="open" :title="data?.code ?? '库存实例预览'" description="库存实例事实">
        <ScrollSurface class="min-h-0 flex-1">
            <div class="space-y-6 p-6 pr-10">
                <p v-if="loading && !data" role="status" class="text-sm text-muted-foreground">正在加载库存实例</p>
                <div v-if="error" role="alert" class="space-y-3 text-sm">
                    <p class="text-destructive">{{ error }}</p>
                    <Button variant="outline" @click="refresh">重新加载</Button>
                </div>
                <template v-if="data">
                    <header class="flex items-start gap-3">
                        <Package class="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                        <div class="min-w-0 space-y-2">
                            <h2 class="break-words text-lg font-semibold">{{ data.code }}</h2>
                            <p class="break-words text-sm text-muted-foreground">
                                {{ data.label || data.material.name }}
                            </p>
                            <StateBadge :tone="inventoryStatusTone[data.status]">
                                {{ inventoryStatusLabel[data.status] }}
                            </StateBadge>
                        </div>
                    </header>
                    <CopyableId :value="data.id" label="库存实例 ID" />
                    <dl class="space-y-4 border-y py-5 text-sm">
                        <div v-for="fact in facts" :key="fact.label" class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                            <dt class="text-muted-foreground">{{ fact.label }}</dt>
                            <dd class="break-words">{{ fact.value }}</dd>
                        </div>
                    </dl>
                    <p v-if="data.notes" class="whitespace-pre-wrap break-words text-sm">{{ data.notes }}</p>
                </template>
            </div>
        </ScrollSurface>
        <div v-if="data" class="shrink-0 border-t p-6">
            <Button class="w-full" as-child>
                <RouterLink :to="`/main/inventory/detail/${data.id}`">
                    <ArrowUpRight aria-hidden="true" />
                    打开完整详情
                </RouterLink>
            </Button>
        </div>
    </SheetInspector>
</template>
