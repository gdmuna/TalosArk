<script setup lang="ts">
import { computed, useId } from 'vue';
import { Trash2 } from '@lucide/vue';
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/ui/dropdown-menu';
import { Checkbox } from '@/ui/checkbox';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import type { DataTableFilter } from '../type';
import { ScrollSurface } from '@/component/scroll-surface';
const props = defineProps<{ label: string; options: DataTableFilter<unknown>['options']; mode: 'options' | 'text' }>();
const selected = defineModel<string[]>({ required: true });
const inputId = useId();
const selection = computed(() => {
    const count = props.options.filter((option) => selected.value.includes(option.value)).length;
    return count && count === props.options.length ? true : count ? ('indeterminate' as const) : false;
});
function toggle(value: string, checked: boolean) {
    selected.value = checked
        ? [...new Set([...selected.value, value])]
        : selected.value.filter((item) => item !== value);
}
</script>
<template>
    <div class="flex items-center justify-between" data-slot="data-table-filter-header">
        <DropdownMenuLabel class="flex min-w-0 items-center gap-2.5">
            <Checkbox
                v-if="mode !== 'text'"
                :model-value="selection"
                :disabled="!options.length"
                :aria-label="`${selection === true ? '取消全选' : '全选'}${label}`"
                :title="selection === true ? '取消全选' : '全选'"
                @update:model-value="selected = $event === true ? options.map((option) => option.value) : []"
            />
            <span class="truncate">{{ label }}</span>
        </DropdownMenuLabel>
        <Button
            v-if="mode !== 'options'"
            variant="ghost"
            size="icon-sm"
            use-tooltip
            :disabled="!selected.length"
            aria-label="清除此列筛选"
            title="清除此列筛选"
            @click="selected = []"
        >
            <Trash2 class="size-4" aria-hidden="true" />
        </Button>
    </div>
    <DropdownMenuSeparator />
    <div
        v-if="mode === 'text'"
        class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 p-2"
        @keydown="$event.key !== 'Escape' && $event.stopPropagation()"
    >
        <label :for="inputId" class="text-xs text-muted-foreground">包含</label>
        <Input
            :id="inputId"
            :model-value="selected[0] ?? ''"
            :aria-label="`筛选${label}`"
            placeholder="输入关键词"
            class="h-8 min-w-0"
            @update:model-value="selected = $event ? [String($event)] : []"
        />
    </div>
    <ScrollSurface v-if="mode === 'options'" edge-effect="line" class="max-h-64">
        <DropdownMenuItem
            v-for="option in options"
            :key="option.value"
            :aria-label="option.label"
            class="min-h-9 gap-2.5 pr-3"
            @select.prevent="toggle(option.value, !selected.includes(option.value))"
        >
            <Checkbox
                :model-value="selected.includes(option.value)"
                :aria-label="option.label"
                :tabindex="-1"
                @click.stop
                @update:model-value="toggle(option.value, $event === true)"
            />
            <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
            <span v-if="option.count !== undefined" class="text-xs tabular-nums text-muted-foreground">
                {{ option.count }}
            </span>
        </DropdownMenuItem>
    </ScrollSurface>
</template>
