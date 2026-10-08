<script setup lang="ts">
import { RouterTabItem } from '@/component/route-tab';
import { ScrollSurface } from '@/component/scroll-surface';
import { ScrollBar } from '@/ui/scroll-area';
defineProps<{ items: { id: string; label: string }[]; active: string; label: string }>();
defineEmits<{ select: [id: string] }>();
</script>
<template>
    <ScrollSurface class="min-w-0" edges="horizontal" edge-effect="line">
        <nav class="flex items-center gap-4 border-b" :aria-label="label">
            <RouterTabItem
                v-for="item in items"
                :key="item.id"
                :label="item.label"
                :data-active="active === item.id"
                :aria-current="active === item.id ? 'page' : undefined"
                @click="$emit('select', item.id)"
            />
        </nav>
        <ScrollBar orientation="horizontal" class="h-2" />
    </ScrollSurface>
</template>
