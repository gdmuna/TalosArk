<script setup lang="ts">
import { ScrollSurface } from '@/component/scroll-surface';

withDefaults(defineProps<{ label: string; layout?: 'detail' | 'tool' }>(), { layout: 'detail' });
</script>

<template>
    <div :aria-label="label" class="flex min-h-0 min-w-0 flex-1 flex-col" data-slot="resource-detail-page">
        <div class="shrink-0 space-y-4 px-4 pt-4 lg:px-6" data-slot="resource-detail-header">
            <slot name="header" />
        </div>
        <ScrollSurface class="min-h-0 flex-1 scroll-smooth" edge-effect="line">
            <main class="w-full min-w-0 p-4 lg:p-6">
                <div
                    class="@container mx-auto w-full min-w-0 space-y-6"
                    :class="layout === 'tool' ? 'max-w-[1440px]' : 'max-w-[1280px]'"
                    data-slot="resource-detail-content"
                >
                    <slot />
                </div>
            </main>
        </ScrollSurface>
    </div>
</template>
