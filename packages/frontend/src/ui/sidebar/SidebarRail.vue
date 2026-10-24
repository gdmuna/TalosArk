<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/shared/util/cn';
import { useSidebar } from './util';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

const props = defineProps<{
    class?: HTMLAttributes['class'];
}>();

const { toggleSidebar } = useSidebar();
</script>

<template>
    <Tooltip>
        <TooltipTrigger as-child>
            <button
                data-sidebar="rail"
                data-slot="sidebar-rail"
                aria-label="Toggle Sidebar"
                :tabindex="-1"
                :class="
                    cn(
                        'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 sm:flex',
                        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
                        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
                        'hover:group-data-[collapsible=offcanvas]:bg-muted group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
                        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
                        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
                        props.class
                    )
                "
                @click="toggleSidebar"
            >
                <slot />
            </button>
        </TooltipTrigger>
        <TooltipContent side="right">切换侧边栏</TooltipContent>
    </Tooltip>
</template>
