<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FieldVariants } from './variant';
import { cn } from '@/shared/util/cn';
import { fieldVariants } from './variant';

const props = withDefaults(
    defineProps<{
        class?: HTMLAttributes['class'];
        orientation?: FieldVariants['orientation'];
    }>(),
    {
        orientation: 'vertical',
    }
);
</script>

<template>
    <div
        role="group"
        data-slot="field"
        :data-orientation="orientation"
        :class="cn(fieldVariants({ orientation }), props.class)"
    >
        <slot />
    </div>
</template>
