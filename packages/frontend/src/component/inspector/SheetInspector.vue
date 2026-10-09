<script setup lang="ts">
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/ui/sheet';

withDefaults(defineProps<{ title: string; description?: string }>(), {
    description: '查看详情并处理当前对象',
});
const open = defineModel<boolean>('open', { required: true });
</script>

<template>
    <div v-if="$slots.main" class="min-w-0"><slot name="main" /></div>
    <Sheet v-model:open="open">
        <SheetContent side="right" class="w-full gap-0 p-0 sm:max-w-lg">
            <SheetTitle class="sr-only">{{ title }}</SheetTitle>
            <SheetDescription class="sr-only">{{ description }}</SheetDescription>
            <slot :close="() => (open = false)" />
        </SheetContent>
    </Sheet>
</template>
