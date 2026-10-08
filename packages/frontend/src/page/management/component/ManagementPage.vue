<script setup lang="ts">
import { useWorkspaceStore } from '@/module/workspace';
import { ScrollSurface } from '@/component/scroll-surface';

withDefaults(defineProps<{ title: string; layout?: 'wide' | 'table' | 'form'; context?: string }>(), {
    layout: 'wide',
});
const workspace = useWorkspaceStore();
</script>

<template>
    <main class="flex min-h-0 min-w-0 flex-1 flex-col" :aria-label="title">
        <div
            v-if="$slots.navigation"
            data-slot="management-navigation"
            class="flex h-20 shrink-0 items-center px-4 lg:px-6"
        >
            <slot name="navigation" />
        </div>
        <ScrollSurface class="min-h-0 flex-1 scroll-smooth" edge-effect="line">
            <div class="w-full min-w-0 p-5 lg:p-8">
                <div
                    data-slot="management-content"
                    class="mx-auto min-w-0 space-y-6"
                    :class="layout === 'table' ? 'w-fit' : '@container w-full'"
                    :style="{ maxWidth: `min(100%, ${layout === 'form' ? 768 : 1280}px)` }"
                >
                    <header class="flex flex-wrap items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="mb-1 truncate text-sm text-muted-foreground">
                                {{ context ?? workspace.organization?.name ?? '组织' }}
                            </p>
                            <h1 class="text-xl font-semibold">{{ title }}</h1>
                        </div>
                        <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
                            <slot name="actions" />
                        </div>
                    </header>
                    <slot />
                </div>
            </div>
        </ScrollSurface>
    </main>
</template>
