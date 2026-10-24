<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { refDebounced } from '@vueuse/core';
import { Check, ChevronDown } from '@lucide/vue';
import type { Resource } from '@/module/workbench';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/command';

type PickerResource = Pick<Resource, 'id' | 'name'>;
const props = withDefaults(
    defineProps<{
        label: string;
        resources?: PickerResource[];
        activeId: string;
        search?: (
            query: string,
            page: number,
            signal: AbortSignal
        ) => Promise<{ items: PickerResource[]; total: number }>;
    }>(),
    { resources: () => [] }
);
const emit = defineEmits<{ select: [resource: PickerResource] }>();
const open = ref(false),
    query = ref(''),
    page = ref(1),
    total = ref(0),
    loading = ref(false),
    error = ref('');
const searchQuery = refDebounced(query, 200);
const remote = shallowRef<PickerResource[]>([]);
const rows = computed(() =>
    props.search
        ? remote.value
        : props.resources.filter((item) => item.name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()))
);
watch(
    open,
    (visible) => {
        if (!visible || !props.search) return;
        page.value = 1;
        remote.value = [];
    },
    { flush: 'sync' }
);
watch(
    [searchQuery, () => props.activeId],
    () => {
        page.value = 1;
        remote.value = [];
    },
    { flush: 'sync' }
);
watch([open, searchQuery, page], async ([visible], _, onCleanup) => {
    if (!visible || !props.search) return;
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    loading.value = true;
    error.value = '';
    try {
        const result = await props.search(searchQuery.value, page.value, controller.signal);
        if (controller.signal.aborted) return;
        remote.value =
            page.value === 1
                ? result.items
                : [
                      ...remote.value,
                      ...result.items.filter((item) => !remote.value.some((existing) => existing.id === item.id)),
                  ];
        total.value = result.total;
    } catch (cause) {
        if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : '无法加载可访问的记录';
    } finally {
        if (!controller.signal.aborted) loading.value = false;
    }
});
function select(resource: PickerResource) {
    open.value = false;
    emit('select', resource);
}
</script>

<template>
    <Popover v-model:open="open">
        <PopoverTrigger as-child>
            <Button
                variant="ghost"
                size="sm"
                class="h-7 max-w-56 min-w-0 gap-1 px-1.5 font-medium"
                :aria-label="`切换${label}`"
            >
                <span class="truncate">{{ label }}</span>
                <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-80 p-0" aria-label="切换记录">
            <PopoverTitle class="sr-only">切换记录</PopoverTitle>
            <Command>
                <CommandInput
                    placeholder="搜索名称或 ID"
                    aria-label="搜索记录名称或 ID"
                    @update:model-value="query = String($event ?? '')"
                />
                <CommandList class="max-h-72 p-1">
                    <p v-if="loading" role="status" class="p-3 text-sm text-muted-foreground">正在加载</p>
                    <p v-else-if="error" role="alert" class="p-3 text-sm text-destructive">{{ error }}</p>
                    <p v-else-if="!rows.length" class="p-3 text-sm text-muted-foreground">没有可访问的匹配记录</p>
                    <CommandGroup>
                        <CommandItem
                            v-for="resource in rows"
                            :key="resource.id"
                            :value="resource.id"
                            :text-value="resource.name"
                            :keywords="[resource.name, resource.id]"
                            class="gap-3 px-2 py-2"
                            @select="select(resource)"
                        >
                            <span class="min-w-0 flex-1">
                                <span class="block truncate">{{ resource.name }}</span>
                                <span class="mt-1 block font-mono text-xs text-muted-foreground">
                                    {{ resource.id }}
                                </span>
                            </span>
                            <Check
                                v-if="activeId === resource.id"
                                class="size-4 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                        </CommandItem>
                    </CommandGroup>
                    <Button
                        v-if="props.search && rows.length < total && !error"
                        variant="ghost"
                        class="w-full"
                        :disabled="loading"
                        @click="page++"
                    >
                        加载更多
                    </Button>
                </CommandList>
            </Command>
        </PopoverContent>
    </Popover>
</template>
