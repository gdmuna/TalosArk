<script setup lang="ts">
import type { Component } from 'vue';
import { RouterLink } from 'vue-router';
defineProps<{ items: { label: string; icon: Component; value?: string | number; to?: string }[] }>();
</script>
<template>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,260px))] gap-4">
        <component
            :is="item.to ? RouterLink : 'div'"
            v-for="item in items"
            :key="item.label"
            class="flex items-center gap-4 rounded-md border bg-card p-5 shadow-sm"
            :class="
                item.to ? 'transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring' : ''
            "
            :to="item.to"
            :aria-label="item.to ? `查看${item.label}` : undefined"
        >
            <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <component :is="item.icon" class="size-5" aria-hidden="true" />
            </div>
            <div>
                <p class="text-sm">{{ item.label }}</p>
                <p class="mt-1 text-xl font-semibold">{{ item.value ?? '—' }}</p>
            </div>
        </component>
    </div>
</template>
