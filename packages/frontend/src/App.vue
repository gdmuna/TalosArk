<template>
    <TooltipProvider :delay-duration="300">
        <component :is="AppDesktopShell" />
    </TooltipProvider>
</template>

<script setup lang="ts">
import { setLucideProps } from '@lucide/vue';
import AppDesktopShell from '@/layout/shell/AppDesktopShell.vue';
import { TooltipProvider } from '@/ui/tooltip';

setLucideProps({
    strokeWidth: 1.5,
    nonScalingStroke: true,
});
</script>
