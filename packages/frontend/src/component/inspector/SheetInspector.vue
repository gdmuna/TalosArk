<script setup lang="ts">
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/ui/sheet';

const props = withDefaults(defineProps<{ title: string; description?: string; returnFocus?: HTMLElement | null }>(), {
    description: '查看详情并处理当前对象',
});
const open = defineModel<boolean>('open', { required: true });
function restoreFocus(event: Event) {
    if (props.returnFocus?.isConnected) {
        event.preventDefault();
        props.returnFocus.focus({ preventScroll: true });
    }
}
</script>

<template>
    <div v-if="$slots.main" class="min-w-0"><slot name="main" /></div>
    <Sheet v-model:open="open">
        <SheetContent side="right" class="w-full gap-0 p-0 sm:max-w-lg" @close-auto-focus="restoreFocus">
            <SheetTitle class="sr-only">{{ title }}</SheetTitle>
            <SheetDescription class="sr-only">{{ description }}</SheetDescription>
            <slot :close="() => (open = false)" />
        </SheetContent>
    </Sheet>
</template>
