<template>
    <div class="desktop-shell flex flex-col h-svh bg-muted" :class="route.meta.fluidLayout ? 'min-w-0' : 'min-w-4xl'">
        <header
            ref="titlebar"
            data-slot="window-titlebar"
            class="shrink-0 flex h-10 items-center justify-between bg-muted pointer-events-auto"
        >
            <div
                class="application-brand flex items-center justify-between ml-4.5 gap-1 text-md select-none transition-[margin-left] duration-(--sidebar-transition-duration) ease-standard"
            >
                <Box class="fill-primary text-muted size-7.5" stroke-width="2.25" />
                <span class="font-medium">璇玑云库</span>
            </div>
            <div aria-hidden="true" class="w-36 shrink-0" />
        </header>
        <div
            data-slot="window-controls"
            class="window-controls pointer-events-auto fixed top-0 right-0 z-10000 flex h-10 items-center justify-between bg-muted *:h-full *:w-12 *:rounded-none"
        >
            <Button variant="ghost" size="sm" class="p-1" title="最小化">
                <span class="sr-only">最小化</span>
                <Minus stroke-width="1" class="size-5" />
            </Button>
            <Button variant="ghost" size="sm" class="p-1" :title="windowState !== 'maximize' ? '最大化' : '恢复'">
                <template v-if="windowState !== 'maximize'">
                    <span class="sr-only">最大化</span>
                    <Square stroke-width="1" class="size-3.5" />
                </template>
                <template v-else>
                    <span class="sr-only">恢复</span>
                    <Copy stroke-width="1" class="size-3.5 -scale-x-100" />
                </template>
            </Button>
            <Button variant="ghost" size="sm" class="p-1 hover:bg-destructive hover:text-card group" title="关闭">
                <span class="sr-only">关闭</span>
                <X stroke-width="1" class="size-4.5 group-hover:stroke-[1.5] duration-100!" />
            </Button>
        </div>
        <div class="flex min-h-0 min-w-0 flex-1">
            <RouterView />
        </div>
        <div
            ref="overlayContainer"
            data-slot="overlay-container"
            class="pointer-events-none fixed inset-0 z-50 isolate contain-layout"
            :style="{ '--overlay-chrome-height': titlebarHeight + 'px' }"
        />
    </div>
</template>

<script setup lang="ts">
import { Button } from '@/ui/button';

import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useElementBounding } from '@vueuse/core';
import { provideOverlayContainer } from '@/shared/browser/overlay-container';

import { X, Square, Minus, Box, Copy } from '@lucide/vue';

const windowState = ref<'minimize' | 'maximize' | 'normal'>('maximize');
const route = useRoute();
const titlebar = ref<HTMLElement | null>(null);
const overlayContainer = ref<HTMLElement | null>(null);
const { height: titlebarHeight } = useElementBounding(titlebar);
// One window-control group stays above full-window modal overlays.
provideOverlayContainer(overlayContainer);
</script>

<style scoped>
.desktop-shell {
    --sidebar-transition-duration: 240ms;
}

.desktop-shell:has(:deep([data-slot='application-sidebar'][data-collapsed='true'])) .application-brand {
    margin-left: calc(var(--spacing) * 1.5);
}

.desktop-shell:has(:deep([data-slot='sheet-overlay'])) .window-controls,
.desktop-shell:has(:deep([data-slot='dialog-overlay'])) .window-controls {
    background: transparent;
}

.desktop-shell:has(:deep([data-slot='sheet-overlay'])) .window-controls {
    color: white;
    --accent: rgb(255 255 255 / 0.12);
}
</style>
