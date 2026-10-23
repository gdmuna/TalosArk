<script setup lang="ts">
import { useId } from 'vue';
import { Box } from '@lucide/vue';

defineProps<{ title: string; description?: string }>();
const titleId = useId();
</script>

<template>
    <main class="flex min-h-full w-full items-center justify-center px-4 py-8">
        <section class="w-full min-w-0 max-w-md rounded-lg bg-card p-6 sm:p-8" :aria-labelledby="titleId">
            <header class="mb-6">
                <div class="mb-6 flex items-center gap-2 font-semibold">
                    <Box class="size-6 shrink-0 text-primary" aria-hidden="true" />
                    璇玑云库
                </div>
                <h1 :id="titleId" tabindex="-1" class="text-xl font-semibold outline-none">{{ title }}</h1>
                <p v-if="description" class="mt-2 text-sm leading-6 text-muted-foreground">{{ description }}</p>
            </header>
            <slot />
        </section>
    </main>
</template>
