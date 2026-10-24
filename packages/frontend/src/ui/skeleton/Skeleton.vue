<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/shared/util/cn';

interface SkeletonProps {
    class?: HTMLAttributes['class'];
}

const props = defineProps<SkeletonProps>();
</script>

<template>
    <div data-slot="skeleton" :class="cn('animate-pulse rounded-md bg-muted', props.class)" />
</template>
