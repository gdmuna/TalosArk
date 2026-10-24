<script setup lang="ts">
import { ref, useTemplateRef, watch, type Component } from 'vue';
import { unrefElement } from '@vueuse/core';
import { ChevronRight } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/collapsible';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/ui/popover';
import { ScrollSurface } from '@/component/scroll-surface';
import SidebarButton from './SidebarButton.vue';

const props = defineProps<{ collapsed: boolean; label: string; icon: Component }>();
const expanded = ref(true);
const popoverOpen = ref(false);
const trigger = useTemplateRef('trigger');
let handingOffFocus = false;

function close() {
    if (!popoverOpen.value) return;
    // The next overlay must capture a persistent trigger, not a disappearing menu item.
    handingOffFocus = true;
    popoverOpen.value = false;
    unrefElement(trigger)?.focus({ preventScroll: true });
}

function onCloseAutoFocus(event: Event) {
    if (handingOffFocus || !props.collapsed) event.preventDefault();
}

watch(popoverOpen, (open) => {
    if (open) handingOffFocus = false;
});
watch(
    () => props.collapsed,
    () => {
        popoverOpen.value = false;
    }
);

function hideLeavingMode(element: Element) {
    element.setAttribute('inert', '');
    element.setAttribute('aria-hidden', 'true');
}
function showEnteringMode(element: Element) {
    element.removeAttribute('inert');
    element.removeAttribute('aria-hidden');
}
</script>

<template>
    <div class="relative min-w-0" data-slot="sidebar-collapsible">
        <Transition
            name="sidebar-mode"
            @before-leave="hideLeavingMode"
            @before-enter="showEnteringMode"
            @leave-cancelled="showEnteringMode"
        >
            <div v-if="collapsed" key="compact">
                <Popover v-model:open="popoverOpen">
                    <PopoverTrigger as-child>
                        <SidebarButton
                            ref="trigger"
                            :label="label"
                            :icon="icon"
                            :collapsed="collapsed"
                            class="text-muted-foreground"
                        />
                    </PopoverTrigger>
                    <PopoverContent
                        side="right"
                        align="start"
                        :side-offset="12"
                        :collision-padding="8"
                        :aria-label="label"
                        class="max-h-(--reka-popover-content-available-height) w-64 gap-0 overflow-hidden p-0"
                        @close-auto-focus="onCloseAutoFocus"
                    >
                        <PopoverTitle class="shrink-0 px-4 py-3 text-sm">{{ label }}</PopoverTitle>
                        <ScrollSurface class="min-h-0 shrink [--edge-surface:var(--popover)]">
                            <div class="px-1 pb-1"><slot :close="close" /></div>
                        </ScrollSurface>
                    </PopoverContent>
                </Popover>
            </div>
            <Collapsible v-else key="expanded" v-model:open="expanded" class="group flex flex-col gap-0.5">
                <CollapsibleTrigger as-child>
                    <Button class="min-w-0 pl-3" variant="ghost" :aria-label="label">
                        <div class="flex w-full min-w-0 items-center gap-1 text-muted-foreground">
                            <span class="truncate">{{ label }}</span>
                            <ChevronRight
                                class="opacity-0 group-data-[state=closed]:opacity-100 group-data-[state=open]:rotate-90 group-hover:opacity-100 transition-[rotate,opacity] ease-standard"
                                aria-hidden="true"
                            />
                        </div>
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent><slot :close="close" /></CollapsibleContent>
            </Collapsible>
        </Transition>
    </div>
</template>

<style scoped>
.sidebar-mode-enter-active,
.sidebar-mode-leave-active {
    transition: opacity var(--sidebar-transition-duration, 240ms) var(--ease-standard);
}

.sidebar-mode-leave-active {
    position: absolute;
    inset: 0 0 auto;
    pointer-events: none;
}

.sidebar-mode-enter-from,
.sidebar-mode-leave-to {
    opacity: 0;
}
</style>
