<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { Copy } from '@lucide/vue';
import { Button } from '@/ui/button';

const props = defineProps<{ value: string; label: string }>();
const copied = ref(false);
const error = ref('');
const { start, stop } = useTimeoutFn(() => (copied.value = false), 2000, { immediate: false });

watch(
    () => props.value,
    () => {
        stop();
        copied.value = false;
        error.value = '';
    }
);

async function copy() {
    const value = props.value;
    error.value = '';
    copied.value = false;
    try {
        await navigator.clipboard.writeText(value);
        if (value !== props.value) return;
        copied.value = true;
        start();
    } catch {
        if (value === props.value) error.value = '未能复制，请重试';
    }
}
</script>

<template>
    <div class="min-w-0 text-xs text-muted-foreground" data-slot="copyable-id">
        <span class="inline-flex max-w-full items-baseline gap-1.5">
            <span class="shrink-0">ID:</span>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                class="group h-auto min-w-0 items-start gap-1.5 p-0 text-left font-normal hover:bg-transparent"
                :aria-label="`复制${label}`"
                :title="copied ? '已复制' : `复制${label}`"
                @click="copy"
            >
                <span
                    class="min-w-0 whitespace-normal break-all font-mono text-xs group-hover:underline group-focus-visible:underline"
                >
                    {{ value }}
                </span>
                <Copy class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            </Button>
            <span role="status" class="sr-only">{{ copied ? `${label}已复制` : '' }}</span>
        </span>
        <p v-if="error" role="alert" class="mt-1 text-destructive">{{ error }}</p>
    </div>
</template>
