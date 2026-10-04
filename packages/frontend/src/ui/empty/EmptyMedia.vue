<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { EmptyMediaVariants } from './variants';
import { cn } from '@/shared/lib/utils';
import { emptyMediaVariants } from './variants';

const props = withDefaults(
    defineProps<{
        class?: HTMLAttributes['class'];
        variant?: EmptyMediaVariants['variant'];
    }>(),
    {
        variant: 'default',
    }
);
</script>

<template>
    <div data-slot="empty-icon" :data-variant="variant" :class="cn(emptyMediaVariants({ variant }), props.class)">
        <slot />
    </div>
</template>
