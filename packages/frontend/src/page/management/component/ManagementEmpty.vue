<script setup lang="ts">
import { FolderOpen } from '@lucide/vue';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/empty';

defineProps<{ text: string; compact?: boolean }>();
</script>

<template>
    <Empty :class="compact ? 'items-start p-0 py-3 text-left' : 'min-h-40 p-6'">
        <EmptyHeader>
            <EmptyMedia v-if="!compact" variant="icon"><FolderOpen aria-hidden="true" /></EmptyMedia>
            <EmptyTitle class="text-sm font-normal text-muted-foreground">{{ text }}</EmptyTitle>
        </EmptyHeader>
    </Empty>
</template>
