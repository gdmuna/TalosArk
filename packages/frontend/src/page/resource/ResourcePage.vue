<script setup lang="ts">
withDefaults(defineProps<{ label: string; layout?: 'wide' | 'table' }>(), { layout: 'wide' });
</script>

<template>
    <main :aria-label="label" class="w-full min-w-0 p-5 lg:p-8">
        <div
            data-slot="resource-content"
            class="mx-auto min-w-0 space-y-6"
            :class="layout === 'table' ? 'w-fit' : '@container w-full'"
            :style="{ maxWidth: layout === 'table' ? '100%' : 'min(100%, 1280px)' }"
        >
            <div v-if="$slots.actions" class="flex flex-wrap justify-end gap-2"><slot name="actions" /></div>
            <slot />
        </div>
    </main>
</template>
