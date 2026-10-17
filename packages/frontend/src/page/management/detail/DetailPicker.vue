<script setup lang="ts">
import { ChevronDown, Check } from '@lucide/vue';
import { ref } from 'vue';
import { Button } from '@/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/ui/command';
defineProps<{ label: string; activeId: string; options: { id: string; name: string }[] }>();
const emit = defineEmits<{ select: [id: string] }>();
const open = ref(false);
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
                <CommandInput placeholder="搜索模拟对象" />
                <CommandList>
                    <CommandEmpty>没有匹配的对象</CommandEmpty>
                    <CommandItem
                        v-for="item in options"
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
                </CommandList>
            </Command>
        </PopoverContent>
    </Popover>
</template>
