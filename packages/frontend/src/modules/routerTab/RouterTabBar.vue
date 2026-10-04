<template>
    <header class="flex h-20 shrink-0 items-center justify-between gap-6 px-4 lg:px-6">
        <ScrollArea type="auto" edges="horizontal" edge-effect="line" class="min-w-0 flex-1">
            <nav aria-label="页面视图" class="flex gap-6">
                <RouterTabItem
                    v-for="item in tabEntity"
                    :id="item.id"
                    :key="item.id"
                    :label="item.value.label"
                    :disabled="item.value.disabled"
                    :data-active="resolveActiveState(item.value)"
                    :aria-current="resolveActiveState(item.value) ? 'page' : undefined"
                    @click="handleClick(item.id)"
                />
            </nav>
            <ScrollBar orientation="horizontal" class="h-2" />
        </ScrollArea>
        <div v-if="$slots.actions" class="flex shrink-0 items-center gap-3">
            <slot name="actions" />
        </div>
    </header>
</template>

<script setup lang="ts">
import { useRouteTab, type RouteContextValue } from './utils';
import RouterTabItem from './RouterTabItem.vue';

import { matchesRoutePath } from '@/shared/utils';

import { ScrollBar } from '@/ui/scroll-area';
import { ScrollSurface as ScrollArea } from '@/modules/scroll-surface';

import { useRouter, useRoute } from 'vue-router';

const route = useRoute();

interface Props {
    activeStateResolver?: (value: RouteContextValue) => boolean;
}

const props = defineProps<Props>();

function resolveActiveState(value: RouteContextValue) {
    return props.activeStateResolver?.(value) ?? matchesRoutePath(route.path, { type: 'prefix', value: value.path });
}

const { tabEntity, getEntity } = useRouteTab();

const router = useRouter();

function handleClick(tid: string) {
    const item = getEntity(tid);
    if (!item) return;
    router.push(item.value.routerPushPayload ?? item.value.path);
}
</script>

<style scoped></style>
