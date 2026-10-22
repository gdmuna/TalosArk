<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Pause, Play, RotateCw, Square } from '@lucide/vue';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import type { BatchRow, BatchStatus } from './model';
const props = defineProps<{ rows: BatchRow[]; busy: boolean; synchronized: boolean; error?: string }>();
const emit = defineEmits<{ run: []; retry: []; synchronize: []; finish: []; pause: []; skip: [] }>();
const stop = ref(false);
const count = (status: BatchStatus) => props.rows.filter((row) => row.status === status).length;
const pending = computed(() => count('pending')),
    unknown = computed(() => count('unknown'));
const labels: Record<BatchStatus, string> = {
    pending: '待执行',
    unknown: '待核对',
    failed: '失败',
    succeeded: '成功',
    skipped: '已跳过',
};
const columns: DataTableColumn<BatchRow>[] = [
    { id: 'label', label: '项目', value: (row) => row.label, size: 300, fill: true, wrap: true },
    { id: 'status', label: '结果', value: (row) => labels[row.status], size: 110 },
    { id: 'error', label: '信息', value: (row) => row.error, size: 300, wrap: true },
];
</script>

<template>
    <section class="space-y-4" aria-label="批次执行结果">
        <p role="status" class="text-sm tabular-nums">
            共 {{ rows.length }} 项 · 成功 {{ count('succeeded') }} · 失败 {{ count('failed') }} · 待核对
            {{ unknown }} · 待执行 {{ pending }}
        </p>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <DataTable :data="rows" :columns="columns" :filtering="false" :searchable="false" :busy="busy">
            <template #cell-status="{ row }">
                <StateBadge
                    :tone="
                        row.status === 'succeeded'
                            ? 'success'
                            : row.status === 'failed'
                              ? 'destructive'
                              : row.status === 'unknown'
                                ? 'warning'
                                : 'neutral'
                    "
                >
                    {{ labels[row.status] }}
                </StateBadge>
            </template>
        </DataTable>
        <div class="flex flex-wrap justify-end gap-2">
            <Button v-if="busy" variant="outline" @click="emit('pause')">
                <Pause />
                暂停
            </Button>
            <Button v-if="pending || unknown" :disabled="busy" @click="emit('run')">
                <Play />
                {{ unknown ? '核对并继续' : '继续处理' }}
            </Button>
            <Button v-if="count('failed')" variant="outline" :disabled="busy || !!unknown" @click="emit('retry')">
                <RotateCw />
                重试失败项
            </Button>
            <Button v-if="pending" variant="outline" :disabled="busy" @click="stop = true">
                <Square />
                停止剩余项
            </Button>
            <Button v-if="count('succeeded')" variant="outline" :disabled="busy" @click="emit('synchronize')">
                <RotateCw />
                只重新加载
            </Button>
            <Button
                :disabled="busy || !!pending || !!unknown || (!!count('succeeded') && !synchronized)"
                variant="outline"
                @click="emit('finish')"
            >
                <Check />
                结束批次
            </Button>
        </div>
        <Dialog v-model:open="stop">
            <DialogContent>
                <DialogTitle>停止剩余项目</DialogTitle>
                <DialogDescription>
                    跳过尚未发送的 {{ pending }} 项。已经成功的操作不回滚，结果未确认的项目仍须核对。
                </DialogDescription>
                <div class="flex justify-end gap-2">
                    <Button variant="outline" @click="stop = false">取消</Button>
                    <Button
                        @click="
                            emit('skip');
                            stop = false;
                        "
                    >
                        确认停止
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    </section>
</template>
