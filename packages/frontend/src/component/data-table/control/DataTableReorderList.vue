<script setup lang="ts">
import { GripVertical } from '@lucide/vue';
import { useTemplateRef } from 'vue';
import { Button } from '@/ui/button';
import { useDragReorder } from '../interaction/useDragReorder';
import { ScrollSurface } from '@/component/scroll-surface';

const props = defineProps<{ ids: string[]; label: string; itemKeys?: Record<string, string> }>();
const emit = defineEmits<{ reorder: [ids: string[]] }>();
const content = useTemplateRef<HTMLElement>('content');
const { phase, start, end } = useDragReorder(
    'y',
    () => props.ids,
    (ids) => emit('reorder', ids),
    {
        root: () => content.value,
        container: () => content.value?.closest<HTMLElement>('[data-slot="data-table-reorder-list"]'),
    }
);
function key(event: KeyboardEvent, id: string) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const ids = [...props.ids];
    const index = ids.indexOf(id);
    const next = index + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0 || next >= ids.length) return;
    ids.splice(index, 1);
    ids.splice(next, 0, id);
    emit('reorder', ids);
}
</script>

<template>
    <ScrollSurface edge-effect="line" data-slot="data-table-reorder-list">
        <div ref="content" class="relative isolate flex flex-col gap-0.5" :data-reorder-phase="phase">
            <div
                v-for="(id, index) in ids"
                :key="itemKeys?.[id] ?? id"
                :data-reorder-id="id"
                class="relative z-10 flex min-w-0 items-center gap-2 rounded-sm bg-popover py-1"
            >
                <Button
                    variant="ghost"
                    size="icon-sm"
                    use-tooltip
                    draggable="true"
                    class="size-6 cursor-grab text-muted-foreground active:cursor-grabbing"
                    :aria-label="`调整${label}顺序 ${index + 1}`"
                    :title="`调整${label}顺序；拖动或使用上下方向键`"
                    @dragstart="start($event, id)"
                    @dragend="end"
                    @keydown="key($event, id)"
                >
                    <GripVertical class="size-3.5" aria-hidden="true" />
                </Button>
                <slot :id="id" :index="index" />
            </div>
        </div>
    </ScrollSurface>
</template>
