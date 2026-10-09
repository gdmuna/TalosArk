<script setup lang="ts">
import { ScrollSurface } from '@/component/scroll-surface';

defineProps<{ label: string }>();
</script>

<template>
    <div :aria-label="label" class="flex min-h-0 min-w-0 flex-1 flex-col" data-slot="resource-detail-page">
        <div class="shrink-0 space-y-4 px-4 pt-4 lg:px-6" data-slot="resource-detail-header">
            <slot name="header" />
        </div>
        <ScrollSurface class="min-h-0 flex-1 scroll-smooth" edge-effect="line">
            <main class="@container w-full min-w-0 p-5 lg:p-8">
                <div class="mx-auto w-fit min-w-0 max-w-full space-y-6" data-slot="resource-detail-content">
                    <slot />
                </div>
            </main>
        </ScrollSurface>
    </div>
</template>
