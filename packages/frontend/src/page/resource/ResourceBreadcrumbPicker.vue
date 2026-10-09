<script setup lang="ts">
import { ref } from 'vue';
import { Check, ChevronDown } from '@lucide/vue';
import type { Resource } from '@/module/workbench';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/command';

defineProps<{ label: string; resources: Resource[]; activeId: string }>();
const emit = defineEmits<{ select: [resource: Resource] }>();
const open = ref(false);
function select(resource: Resource) {
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
                <CommandInput placeholder="搜索名称或 ID" aria-label="搜索记录名称或 ID" />
                <CommandList class="max-h-72 p-1">
                    <CommandEmpty>没有找到匹配记录</CommandEmpty>
                    <CommandGroup>
                        <CommandItem
                            v-for="resource in resources"
                            :key="resource.id"
                            :value="resource.id"
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
                </CommandList>
            </Command>
        </PopoverContent>
    </Popover>
</template>
