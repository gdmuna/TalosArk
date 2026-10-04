<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
    label: string;
    items: { value: string; label: string; icon: Component; color: string; count: number }[];
}>();
</script>

<template>
    <section :aria-label="label" class="mb-5 flex shrink-0 flex-wrap gap-3" data-slot="workbench-summary">
        <div
            v-for="item in items"
            :key="item.value"
            class="flex w-60 max-w-full items-center gap-3 rounded-lg border bg-card p-4 shadow-xs"
        >
            <span :class="['flex size-10 shrink-0 items-center justify-center rounded-md', item.color]">
                <component :is="item.icon" class="size-5" aria-hidden="true" />
            </span>
            <dl class="min-w-0">
                <dt class="text-sm">{{ item.label }}</dt>
                <dd class="mt-1 text-xl font-semibold tabular-nums">{{ item.count }}</dd>
            </dl>
        </div>
    </section>
</template>
