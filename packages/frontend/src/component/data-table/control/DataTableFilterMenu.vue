<script setup lang="ts" generic="T">
import { computed } from 'vue';
import { ListFilter, Trash2 } from '@lucide/vue';
import { Button } from '@/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import DataTableFilterOptions from './DataTableFilterInput.vue';
import TableViewHelp from './TableViewHelp.vue';
import type { DataTableColumn, DataTableFilter } from '../type';
const props = defineProps<{ fields: (DataTableFilter<T> & Pick<DataTableColumn<T>, 'icon'>)[] }>();
const filters = defineModel<Record<string, string[]>>({ required: true });
const activeCount = computed(() => props.fields.filter((field) => filters.value[field.id]?.length).length);
function selectedLabel(field: DataTableFilter<T>) {
    const values = filters.value[field.id] ?? [];
    return !values.length
        ? '不限'
        : field.mode === 'text'
          ? `包含“${values[0]}”`
          : values.length === 1
            ? (field.options.find((option) => option.value === values[0])?.label ?? values[0])
            : `${values.length} 项`;
}
function setFilter(id: string, values: string[]) {
    const next = { ...filters.value };
    if (values.length) next[id] = values;
    else delete next[id];
    filters.value = next;
}
</script>
<template>
    <div class="flex shrink-0 items-center gap-2" data-slot="data-table-filters">
        <DropdownMenu v-if="fields.length">
            <DropdownMenuTrigger as-child>
                <Button variant="outline" size="sm" aria-label="添加筛选条件">
                    <ListFilter class="size-3.5" aria-hidden="true" />
                    筛选
                    <span v-if="activeCount" class="rounded-sm bg-muted px-1 text-xs tabular-nums">
                        {{ activeCount }}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-80" aria-label="筛选条件">
                <div class="flex items-center justify-between">
                    <DropdownMenuLabel class="flex items-center justify-center gap-1">
                        筛选条件
                        <TableViewHelp />
                    </DropdownMenuLabel>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        use-tooltip
                        :disabled="!activeCount"
                        aria-label="清除全部筛选"
                        title="清除全部筛选"
                        @click="filters = {}"
                    >
                        <Trash2 class="size-4" aria-hidden="true" />
                    </Button>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuSub v-for="field in fields" :key="field.id">
                    <DropdownMenuSubTrigger
                        class="grid min-h-9 grid-cols-[1rem_minmax(0,1fr)_6.5rem_1rem] gap-2.5"
                        :data-filter-id="field.id"
                        :title="`${field.label}：${selectedLabel(field)}`"
                    >
                        <span class="flex size-4 items-center justify-center">
                            <component :is="field.icon" v-if="field.icon" class="size-4" aria-hidden="true" />
                        </span>
                        <span class="min-w-0 truncate">{{ field.label }}</span>
                        <span
                            class="min-w-0 truncate text-xs text-muted-foreground"
                            data-slot="data-table-filter-summary"
                        >
                            {{ selectedLabel(field) }}
                        </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent class="w-60 max-h-80 overflow-y-auto" :aria-label="field.label">
                        <DataTableFilterOptions
                            :label="field.label"
                            :options="field.options"
                            :mode="field.mode"
                            :model-value="filters[field.id] ?? []"
                            @update:model-value="setFilter(field.id, $event)"
                        />
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuContent>
        </DropdownMenu>
    </div>
</template>
