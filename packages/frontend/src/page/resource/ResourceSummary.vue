<script setup lang="ts">
import type { Component } from 'vue';
defineProps<{ items: { label: string; icon: Component; value?: string | number }[] }>();
</script>
<template>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,260px))] gap-4">
        <div
            v-for="item in items"
            :key="item.label"
            class="flex items-center gap-4 rounded-md border bg-card p-5 shadow-sm"
        >
            <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <component :is="item.icon" class="size-5" aria-hidden="true" />
            </div>
            <div>
                <p class="text-sm">{{ item.label }}</p>
                <p class="mt-1 text-xl font-semibold">{{ item.value ?? '—' }}</p>
            </div>
        </div>
    </div>
</template>
