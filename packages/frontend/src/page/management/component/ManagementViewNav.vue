<script setup lang="ts">
import { RouterTabItem } from '@/component/route-tab';
import { ScrollSurface } from '@/component/scroll-surface';
import { ScrollBar } from '@/ui/scroll-area';
import type { ManagementView } from '../useManagementView';

defineProps<{ items: readonly ManagementView[]; label: string }>();
const selected = defineModel<string>({ required: true });
</script>

<template>
    <ScrollSurface edges="horizontal" edge-effect="line" class="min-w-0 flex-1">
        <nav :aria-label="label" class="flex w-max min-w-full gap-6">
            <RouterTabItem
                v-for="item in items"
                :key="item.value"
                :label="item.label"
                :data-active="selected === item.value"
                :aria-current="selected === item.value ? 'page' : undefined"
                @click="selected = item.value"
            />
        </nav>
        <ScrollBar orientation="horizontal" class="h-2" />
    </ScrollSurface>
</template>
