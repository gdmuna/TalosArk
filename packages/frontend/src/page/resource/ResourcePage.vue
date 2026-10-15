<script setup lang="ts">
withDefaults(defineProps<{ label: string; layout?: 'wide' | 'table' | 'tool' | 'full' }>(), { layout: 'wide' });
</script>

<template>
    <main :aria-label="label" class="w-full min-w-0 p-4 lg:p-6">
        <div
            data-slot="resource-content"
            class="@container mx-auto w-full min-w-0 space-y-6"
            :class="layout === 'full' ? '' : layout === 'tool' ? 'max-w-[1440px]' : 'max-w-[1200px]'"
        >
            <div v-if="$slots.actions" class="flex flex-wrap justify-end gap-2"><slot name="actions" /></div>
            <slot />
        </div>
    </main>
</template>
