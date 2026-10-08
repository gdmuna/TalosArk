<template>
    <div class="desktop-shell flex flex-col h-svh min-w-4xl bg-muted">
        <header
            ref="titlebar"
            data-slot="window-titlebar"
            class="shrink-0 flex h-10 items-center justify-between bg-muted pointer-events-auto"
        >
            <div class="flex items-center justify-between ml-4.5 gap-1 text-md select-none">
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
                <Minus class="size-5" />
            </Button>
            <Button variant="ghost" size="sm" class="p-1" :title="windowState !== 'maximize' ? '最大化' : '还原'">
                <template v-if="windowState !== 'maximize'">
                    <span class="sr-only">最大化</span>
                    <Square class="size-3.5" />
                </template>
                <template v-else>
                    <span class="sr-only">还原</span>
                    <Copy class="size-3.5 -scale-x-100" />
                </template>
            </Button>
            <Button variant="ghost" size="sm" class="p-1 hover:bg-destructive hover:text-card" title="关闭">
                <span class="sr-only">关闭</span>
                <X class="size-4.5" />
            </Button>
        </div>
        <SidebarProvider class="min-h-0 flex-1">
            <RouterView />
        </SidebarProvider>
        <div
            ref="overlayContainer"
            data-slot="overlay-container"
            class="pointer-events-none fixed inset-0 z-50 isolate [contain:layout]"
            :style="{ '--overlay-chrome-height': titlebarHeight + 'px' }"
        />
    </div>
</template>

<script setup lang="ts">
import { Button } from '@/ui/button';
import { SidebarProvider } from '@/ui/sidebar';

import { ref } from 'vue';
import { useElementBounding } from '@vueuse/core';
import { provideOverlayContainer } from '@/shared/browser/overlay-container';

import { X, Square, Minus, Box, Copy } from '@lucide/vue';

const windowState = ref<'minimize' | 'maximize' | 'normal'>('maximize');
const titlebar = ref<HTMLElement | null>(null);
const overlayContainer = ref<HTMLElement | null>(null);
const { height: titlebarHeight } = useElementBounding(titlebar);
// One window-control group stays above full-window modal overlays.
provideOverlayContainer(overlayContainer);
</script>

<style scoped>
.desktop-shell:has(:deep([data-slot='sheet-overlay'])) .window-controls,
.desktop-shell:has(:deep([data-slot='dialog-overlay'])) .window-controls {
    background: transparent;
}

.desktop-shell:has(:deep([data-slot='sheet-overlay'])) .window-controls {
    color: white;
    --accent: rgb(255 255 255 / 0.12);
}
</style>
