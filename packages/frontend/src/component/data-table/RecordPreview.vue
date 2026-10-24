<script setup lang="ts" generic="T extends { id: string }">
import { computed } from 'vue';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import type { DataTableColumn } from './type';

const props = defineProps<{ row?: T; columns: DataTableColumn<T>[] }>();
const open = defineModel<boolean>('open', { required: true });
const title = computed(() => (props.row ? String(props.columns[0]?.value(props.row) ?? props.row.id) : '记录预览'));
</script>

<template>
    <SheetInspector v-model:open="open" :title="title" description="当前记录的字段摘要">
        <ScrollSurface v-if="row" class="min-h-0 flex-1 p-6 pt-10">
            <h2 class="mb-3 pr-6 text-lg font-semibold">{{ title }}</h2>
            <CopyableId :value="row.id" label="记录 ID" />
            <dl class="mt-6 grid grid-cols-[minmax(5rem,1fr)_minmax(0,2fr)] gap-x-4 gap-y-4 border-t pt-6 text-sm">
                <template v-for="column in columns" :key="column.id">
                    <dt class="text-muted-foreground">{{ column.label }}</dt>
                    <dd class="break-words">{{ column.value(row) }}</dd>
                </template>
            </dl>
        </ScrollSurface>
    </SheetInspector>
</template>
