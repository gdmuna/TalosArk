<script setup lang="ts">
import { computed, watch } from 'vue';
import { useInventoryDataSource, useInventoryRead } from '../model/read';
import { inventoryStatusLabel, inventoryTransactionLabel } from '../model/presentation';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { ScrollArea } from '@/ui/scroll-area';
import { Button } from '@/ui/button';
import { ArrowUpRight } from '@lucide/vue';
import { RouterLink } from 'vue-router';

const id = defineModel<string>('id', { default: '' });
const source = useInventoryDataSource();
const { data, loading, error, refresh, scope } = useInventoryRead(
    computed(() => id.value),
    (currentScope, signal) => {
        if (!source) return Promise.reject(new Error('库存数据源未连接'));
        return source.transaction(currentScope, id.value, signal);
    }
);
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
function status(value: string | null) {
    return value ? (inventoryStatusLabel[value as keyof typeof inventoryStatusLabel] ?? value) : '无';
}
</script>

<template>
    <SheetInspector v-model:open="open" title="库存流水详情" description="操作时保存的库存与位置快照">
        <div class="shrink-0 border-b p-6 pr-12"><h2 class="text-lg font-semibold">库存流水详情</h2></div>
        <ScrollArea class="min-h-0 flex-1">
            <div class="space-y-5 p-6">
                <p v-if="loading && !data" class="text-sm text-muted-foreground">正在加载流水详情</p>
                <div v-if="error" role="alert" class="space-y-2 text-sm">
                    <p class="text-destructive">{{ error }}</p>
                    <Button variant="outline" @click="refresh">重新加载</Button>
                </div>
                <template v-if="data">
                    <CopyableId :value="data.id" label="流水 ID" />
                    <CopyableId :value="data.operationId" label="操作 ID" />
                    <dl class="grid gap-4 text-sm">
                        <div>
                            <dt class="text-muted-foreground">类型</dt>
                            <dd>{{ inventoryTransactionLabel(data.type) }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">发生时间</dt>
                            <dd>{{ new Date(data.occurredAt).toLocaleString('zh-CN', { hour12: false }) }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">操作人 ID</dt>
                            <dd class="break-all">{{ data.actorUserId }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">原因</dt>
                            <dd class="whitespace-pre-wrap break-words">{{ data.reason || '无' }}</dd>
                        </div>
                    </dl>
                    <section class="space-y-3">
                        <h3 class="border-b pb-2 font-medium">明细（{{ data.lines.length }}）</h3>
                        <div
                            v-for="line in data.lines"
                            :key="line.lineNumber"
                            class="space-y-3 border-b pb-4 text-sm last:border-0"
                        >
                            <p class="font-medium">第 {{ line.lineNumber }} 项</p>
                            <CopyableId :value="line.stockItemId" label="库存 ID" />
                            <Button variant="outline" size="sm" as-child>
                                <RouterLink :to="`/main/inventory/detail/${line.stockItemId}`">
                                    <ArrowUpRight aria-hidden="true" />
                                    查看库存实例
                                </RouterLink>
                            </Button>
                            <dl class="grid gap-3">
                                <div>
                                    <dt class="text-muted-foreground">数量</dt>
                                    <dd>
                                        {{ line.quantityBefore }} → {{ line.quantityAfter }} {{ line.unitSnapshot }}
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-muted-foreground">状态</dt>
                                    <dd>{{ status(line.statusBefore) }} → {{ status(line.statusAfter) }}</dd>
                                </div>
                                <div>
                                    <dt class="text-muted-foreground">来源位置快照</dt>
                                    <dd class="break-words">
                                        {{
                                            line.fromLocationRestricted
                                                ? '位置受限'
                                                : (line.fromNodePathSnapshot ?? '无')
                                        }}
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-muted-foreground">目标位置快照</dt>
                                    <dd class="break-words">
                                        {{ line.toLocationRestricted ? '位置受限' : (line.toNodePathSnapshot ?? '无') }}
                                    </dd>
                                </div>
                            </dl>
                            <CopyableId v-if="line.fromNodeId" :value="line.fromNodeId" label="来源位置 ID" />
                            <CopyableId v-if="line.toNodeId" :value="line.toNodeId" label="目标位置 ID" />
                        </div>
                    </section>
                </template>
            </div>
        </ScrollArea>
    </SheetInspector>
</template>
