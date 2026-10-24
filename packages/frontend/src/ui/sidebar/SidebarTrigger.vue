<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { PanelLeft } from '@lucide/vue';
import { cn } from '@/shared/util/cn';
import { Button } from '@/ui/button';
import { useSidebar } from './util';

const props = defineProps<{
    class?: HTMLAttributes['class'];
}>();

const { toggleSidebar } = useSidebar();
</script>

<template>
    <Button
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        variant="ghost"
        size="icon"
        use-tooltip
        aria-label="切换侧边栏"
        :class="cn('h-7 w-7', props.class)"
        @click="toggleSidebar"
    >
        <PanelLeft />
        <span class="sr-only">Toggle Sidebar</span>
    </Button>
</template>
