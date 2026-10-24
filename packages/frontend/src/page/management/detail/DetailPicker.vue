<script setup lang="ts">
import { ChevronDown, Check } from '@lucide/vue';
import { computed, ref, shallowRef, watch } from 'vue';
import { refDebounced } from '@vueuse/core';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/popover';
import { Command, CommandList, CommandItem } from '@/ui/command';
import { teamErrorMessage } from '@/module/workspace';
const props = withDefaults(
    defineProps<{
        label: string;
        activeId: string;
        options?: { id: string; name: string }[];
        search?: (
            query: string,
            page: number,
            signal: AbortSignal
        ) => Promise<{ items: { id: string; name: string }[]; total: number }>;
    }>(),
    { options: () => [] }
);
const emit = defineEmits<{ select: [id: string] }>();
const open = ref(false),
    query = ref(''),
    page = ref(1),
    total = ref(0),
    loading = ref(false),
    error = ref('');
const searchQuery = refDebounced(query, 200);
const remote = shallowRef<{ id: string; name: string }[]>([]);
watch(
    open,
    (value) => {
        if (value && props.search) {
            page.value = 1;
            remote.value = [];
        }
    },
    { flush: 'sync' }
);
const rows = computed(() =>
    props.search
        ? remote.value
        : props.options.filter((item) => item.name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()))
);
watch(
    [searchQuery, () => props.activeId],
    () => {
        page.value = 1;
        remote.value = [];
    },
    { flush: 'sync' }
);
watch([open, searchQuery, page, () => props.activeId], async ([visible], _, onCleanup) => {
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
        if (!controller.signal.aborted) error.value = teamErrorMessage(cause);
    } finally {
        if (!controller.signal.aborted) loading.value = false;
    }
});
</script>
<template>
    <Popover v-model:open="open">
        <PopoverTrigger as-child>
            <Button variant="ghost" size="sm" class="max-w-64" :aria-label="`切换对象：${label}`">
                <span class="truncate">{{ label }}</span>
                <ChevronDown class="size-3.5 shrink-0" />
            </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-80 p-0">
            <Command>
                <div class="border-b p-2"><Input v-model="query" placeholder="搜索对象" aria-label="搜索对象" /></div>
                <CommandList>
                    <CommandItem
                        v-for="item in rows"
                        :key="item.id"
                        :value="item.id"
                        :text-value="item.name"
                        @select="
                            () => {
                                open = false;
                                emit('select', item.id);
                            }
                        "
                    >
                        <span class="min-w-0 flex-1 break-words">{{ item.name }}</span>
                        <Check v-if="item.id === activeId" class="size-4" />
                    </CommandItem>
                    <p v-if="loading" role="status" class="p-3 text-sm text-muted-foreground">正在加载</p>
                    <p v-else-if="error" role="alert" class="p-3 text-sm text-destructive">{{ error }}</p>
                    <p v-else-if="!rows.length" class="p-3 text-sm text-muted-foreground">没有可访问的匹配对象</p>
                    <Button
                        v-if="search && rows.length < total && !error"
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
