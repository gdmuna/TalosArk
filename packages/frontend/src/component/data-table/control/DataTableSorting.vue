<script setup lang="ts">
import { computed, toRaw } from 'vue';
import { ArrowDownUp, Plus, Trash2, X } from '@lucide/vue';
import type { SortingState } from '@tanstack/vue-table';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { SelectField } from '@/component/select-field';
import DataTableReorderList from './DataTableReorderList.vue';
import TableViewHelp from './TableViewHelp.vue';
import type { DataTableColumn } from '../type';

const props = defineProps<{ columns: Pick<DataTableColumn<unknown>, 'id' | 'label' | 'icon'>[] }>();
const sorting = defineModel<SortingState>({ required: true });
const keys = new WeakMap<object, string>();
let nextKey = 0;
function ruleKey(rule: SortingState[number]) {
    const raw = toRaw(rule);
    let key = keys.get(raw);
    if (!key) {
        key = `sort-rule-${++nextKey}`;
        keys.set(raw, key);
    }
    return key;
}
const itemKeys = computed(() => Object.fromEntries(sorting.value.map((rule) => [rule.id, ruleKey(rule)])));
const available = computed(() =>
    props.columns.filter((column) => !sorting.value.some((sort) => sort.id === column.id))
);
function update(index: number, value: Partial<SortingState[number]>) {
    sorting.value = sorting.value.map((sort, current) => {
        if (current !== index) return sort;
        const updated = { ...sort, ...value };
        keys.set(updated, ruleKey(sort));
        return updated;
    });
}
function remove(index: number, event: MouseEvent) {
    // Keep focus inside the panel when its focused row is removed.
    (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-slot=popover-content]')?.focus();
    sorting.value = sorting.value.filter((_, current) => current !== index);
}
function reorder(ids: string[]) {
    sorting.value = [...sorting.value].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}
</script>

<template>
    <Popover>
        <PopoverTrigger as-child>
            <Button variant="outline" size="sm" aria-label="排序器">
                <ArrowDownUp class="size-3.5" aria-hidden="true" />
                排序
                <span v-if="sorting.length" class="rounded-sm bg-muted px-1 text-xs tabular-nums">
                    {{ sorting.length }}
                </span>
            </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-96 gap-2 p-2" aria-label="排序器" tabindex="-1">
            <PopoverTitle class="flex items-center gap-1 px-1 py-1 text-sm">
                排序
                <TableViewHelp />
            </PopoverTitle>
            <DataTableReorderList
                :ids="sorting.map((sort) => sort.id)"
                :item-keys="itemKeys"
                label="排序优先级"
                class="max-h-72"
                @reorder="reorder"
            >
                <template #default="{ id, index }">
                    <SelectField
                        :model-value="id"
                        :label="`第 ${index + 1} 排序字段`"
                        class="h-8 min-w-0 flex-1"
                        :options="
                            columns
                                .filter((column) => column.id === id || available.some((item) => item.id === column.id))
                                .map((column) => ({ value: column.id, label: column.label }))
                        "
                        @update:model-value="update(index, { id: $event })"
                    >
                        <!-- <template #title-after><TableViewHelp /></template> -->
                    </SelectField>
                    <SelectField
                        :model-value="sorting[index]?.desc ? 'desc' : 'asc'"
                        :label="`第 ${index + 1} 排序方向`"
                        class="h-8 min-w-20 w-20"
                        :options="[
                            { value: 'asc', label: '升序' },
                            { value: 'desc', label: '降序' },
                        ]"
                        @update:model-value="update(index, { desc: $event === 'desc' })"
                    ></SelectField>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        use-tooltip
                        class="size-7"
                        :aria-label="`删除第 ${index + 1} 排序`"
                        title="删除此排序"
                        @click="remove(index, $event)"
                    >
                        <X class="size-3.5" aria-hidden="true" />
                    </Button>
                </template>
            </DataTableReorderList>
            <p v-if="!sorting.length" class="px-2 py-2 text-xs text-muted-foreground">暂无排序</p>
            <div class="flex items-center justify-between border-t pt-2">
                <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="sm" :disabled="!available.length">
                            <Plus aria-hidden="true" />
                            添加排序
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent class="w-48">
                        <DropdownMenuLabel class="flex items-center gap-1">
                            添加排序字段
                            <TableViewHelp />
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            v-for="column in available"
                            :key="column.id"
                            @select="sorting = [...sorting, { id: column.id, desc: false }]"
                        >
                            <component :is="column.icon" v-if="column.icon" aria-hidden="true" />
                            {{ column.label }}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" :disabled="!sorting.length" @click="sorting = []">
                    <Trash2 aria-hidden="true" />
                    清除排序
                </Button>
            </div>
        </PopoverContent>
    </Popover>
</template>
