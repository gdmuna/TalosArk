<script setup lang="ts">
withDefaults(defineProps<{ label: string; layout?: 'wide' | 'table' | 'tool' | 'data' | 'fluid' }>(), {
    layout: 'wide',
});
</script>

<template>
    <main :aria-label="label" class="w-full min-w-0 p-4 lg:p-6">
        <div
            data-slot="resource-content"
            class="mx-auto min-w-0 space-y-6"
            :class="{
                'w-fit max-w-full': layout === 'table' || layout === 'data',
                '@container w-full': layout !== 'table' && layout !== 'data',
                'max-w-[1200px]': layout === 'wide',
            }"
        >
            <div v-if="$slots.actions" class="flex flex-wrap justify-end gap-2"><slot name="actions" /></div>
            <slot />
        </div>
    </main>
</template>
