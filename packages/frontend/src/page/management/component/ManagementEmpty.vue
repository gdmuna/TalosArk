<script setup lang="ts">
import { FolderOpen } from '@lucide/vue';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/empty';

defineProps<{ text: string }>();
</script>

<template>
    <Empty class="min-h-40 p-6">
        <EmptyHeader>
            <EmptyMedia variant="icon"><FolderOpen aria-hidden="true" /></EmptyMedia>
            <EmptyTitle class="text-sm font-normal text-muted-foreground">{{ text }}</EmptyTitle>
        </EmptyHeader>
    </Empty>
</template>
