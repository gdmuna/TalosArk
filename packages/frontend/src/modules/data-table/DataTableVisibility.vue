<script setup lang="ts">
import { computed } from 'vue';
import { Columns3, Eye, EyeOff } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/ui/popover';
import DataTableReorderList from './DataTableReorderList.vue';
import TableViewHelp from './TableViewHelp.vue';
import type { DataTableColumn } from './types';

const props = defineProps<{
    columns: Pick<DataTableColumn<unknown>, 'id' | 'label' | 'icon'>[];
    hasActions: boolean;
}>();
const order = defineModel<string[]>('order', { required: true });
const visibility = defineModel<Record<string, boolean>>('visibility', { required: true });
const columnById = computed(() => new Map(props.columns.map((column) => [column.id, column])));
const shown = computed(() => props.columns.filter((column) => visibility.value[column.id] !== false));
const canHide = (id: string) => visibility.value[id] === false || props.hasActions || shown.value.length > 1;
function toggle(id: string) {
    if (canHide(id)) visibility.value = { ...visibility.value, [id]: visibility.value[id] === false };
}
</script>

<template>
    <Popover>
        <PopoverTrigger as-child>
            <Button variant="ghost" size="icon-sm" use-tooltip tooltip="列可见性与顺序" aria-label="列可见性">
                <Columns3 class="size-4" aria-hidden="true" />
            </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="w-72 gap-2 p-2" aria-label="列可见性">
            <div class="flex items-center justify-between px-1">
                <PopoverTitle class="flex items-center gap-1 text-sm">
                    列可见性
                    <TableViewHelp />
                </PopoverTitle>
                <Button variant="ghost" size="sm" class="h-7 px-1 text-xs text-primary" @click="visibility = {}">
                    全部显示
                </Button>
            </div>
            <DataTableReorderList :ids="order" label="列" class="max-h-72" @reorder="order = $event">
                <template #default="{ id }">
                    <component
                        :is="columnById.get(id)?.icon"
                        v-if="columnById.get(id)?.icon"
                        class="size-4 shrink-0 text-muted-foreground pointer-events-none"
                        aria-hidden="true"
                    />
                    <span :class="['min-w-0 flex-1 truncate', visibility[id] === false && 'text-muted-foreground']">
                        {{ columnById.get(id)?.label }}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        use-tooltip
                        class="size-7"
                        :disabled="!canHide(id)"
                        :aria-label="`${visibility[id] === false ? '显示' : '隐藏'}${columnById.get(id)?.label}列`"
                        :title="visibility[id] === false ? '显示此列' : '隐藏此列'"
                        @click="toggle(id)"
                    >
                        <component :is="visibility[id] === false ? EyeOff : Eye" class="size-3.5" aria-hidden="true" />
                    </Button>
                </template>
            </DataTableReorderList>
        </PopoverContent>
    </Popover>
</template>
