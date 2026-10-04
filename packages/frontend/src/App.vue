<template>
    <TooltipProvider :delay-duration="300">
        <component :is="AppDesktopShell" />
    </TooltipProvider>
</template>

<script setup lang="ts">
import AppDesktopShell from '@/layout/shell/AppDesktopShell.vue';
import { TooltipProvider } from '@/ui/tooltip';
</script>
