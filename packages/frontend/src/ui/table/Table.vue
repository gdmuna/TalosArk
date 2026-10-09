<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/shared/util/cn';

const props = defineProps<{
    class?: HTMLAttributes['class'];
    containerClass?: HTMLAttributes['class'];
    role?: HTMLAttributes['role'];
}>();
</script>

<template>
    <div data-slot="table-container" :class="cn('relative w-full overflow-x-auto', props.containerClass)">
        <table data-slot="table" :role="props.role" :class="cn('w-full caption-bottom text-sm', props.class)">
            <slot />
        </table>
    </div>
</template>
