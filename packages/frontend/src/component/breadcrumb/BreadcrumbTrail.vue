<script setup lang="ts">
import type { BreadcrumbEntry } from './type';

defineProps<{ entries: BreadcrumbEntry[] }>();
</script>

<template>
    <nav aria-label="当前位置" class="min-w-0 overflow-x-auto [scrollbar-width:none]">
        <ol class="flex w-max min-w-0 items-center gap-2 text-sm font-medium lg:text-base">
            <li v-for="(entry, index) in entries" :key="entry.id" class="flex min-w-0 items-center gap-2">
                <span v-if="index" class="text-muted-foreground" aria-hidden="true">/</span>
                <component :is="entry.component" v-if="entry.component" v-bind="entry.props" />
                <RouterLink
                    v-else-if="entry.to"
                    :to="entry.to"
                    class="max-w-48 truncate text-muted-foreground hover:text-foreground"
                >
                    {{ entry.label }}
                </RouterLink>
                <button
                    v-else-if="entry.select"
                    type="button"
                    class="max-w-48 truncate text-muted-foreground hover:text-foreground"
                    @click="entry.select"
                >
                    {{ entry.label }}
                </button>
                <span
                    v-else
                    class="max-w-48 truncate"
                    :class="index === entries.length - 1 ? 'text-primary' : 'text-muted-foreground'"
                    :aria-current="index === entries.length - 1 ? 'page' : undefined"
                >
                    {{ entry.label }}
                </span>
            </li>
        </ol>
    </nav>
</template>
