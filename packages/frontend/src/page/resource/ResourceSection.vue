<script setup lang="ts">
import { useId } from 'vue';
defineProps<{ title: string }>();
const heading = useId();
</script>
<template>
    <section class="min-w-0 space-y-4" :aria-labelledby="heading">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <h2 :id="heading" class="font-semibold">{{ title }}</h2>
            <slot name="actions" />
        </div>
        <slot />
    </section>
</template>
