<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { Button } from '@/ui/button';
import { SelectField } from '@/component/select-field';
defineProps<{ page: number; pageSize: number; total?: number; loading: boolean; error: boolean }>();
defineEmits<{ page: [value: number]; size: [value: string] }>();
</script>
<template>
    <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span class="text-muted-foreground" role="status">
            {{ total === undefined ? '总量暂不可用' : `共 ${total} 项` }}
        </span>
        <div class="flex flex-wrap items-center gap-3">
            <SelectField
                :model-value="String(pageSize)"
                hide-title
                label="每页条数"
                class="min-w-24 h-8"
                :options="[10, 20, 50, 100].map((size) => ({ value: String(size), label: `${size} 条` }))"
                @update:model-value="$emit('size', $event)"
            />
            <span class="tabular-nums">
                第 {{ page }} 页
                <template v-if="total !== undefined">，共 {{ Math.max(1, Math.ceil(total / pageSize)) }} 页</template>
            </span>
            <Button
                variant="outline"
                size="icon-sm"
                use-tooltip
                tooltip="上一页"
                :disabled="loading || page <= 1"
                @click="$emit('page', page - 1)"
            >
                <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
                variant="outline"
                size="icon-sm"
                use-tooltip
                tooltip="下一页"
                :disabled="loading || error || total === undefined || page * pageSize >= total"
                @click="$emit('page', page + 1)"
            >
                <ChevronRight aria-hidden="true" />
            </Button>
        </div>
    </div>
</template>
