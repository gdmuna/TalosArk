<template>
    <template v-for="context in store" :key="context[0]">
        <template v-for="entity in context[1]" :key="entity[0]">
            <KeepAlive>
                <component :is="entity[1].component" v-if="isActive(context[0], entity[0])" />
            </KeepAlive>
        </template>
    </template>
</template>

<script setup lang="ts">
import { useTab } from './useTab';
import { useTabComponent } from './useTabComponent';
import { useViewHistory } from '../useViewHistory/useViewHistory';

import { useEventBus } from './eventBus';

import { useRouter, type RouteLocationNormalized } from 'vue-router';
import { computed, onUnmounted, type Component } from 'vue';

interface Props {
    Component: Component;
}

const props = withDefaults(defineProps<Props>(), {});

const { activeTabId, createTab, setActiveTabId, activeTabIdIsNull } = useTab();

const { register, drop, store, state, createTabRule } = useTabComponent();

const { getEntity, pushNow } = useViewHistory();

const router = useRouter();

const currentRoutePath = computed(() => router.currentRoute.value.path);

register(
    activeTabId,
    currentRoutePath,
    computed(() => props.Component)
);

function isActive(tabId: string, path: string) {
    if (state.value === 'switching') return false;
    return tabId === activeTabId.value && path === currentRoutePath.value;
}

const { on } = useEventBus();

on('workbench.tab:delete', ({ tabId }) => {
    drop({ tabId });
});

const guard = (to: RouteLocationNormalized) => {
    if (!activeTabIdIsNull.value) return true;
    for (const pattern of createTabRule.values()) {
        const matched = pattern.test(to.fullPath);
        if (matched) {
            const { id } = createTab();
            setActiveTabId(id);
            break;
        }
    }
    return true;
};

const removeRouterHook = router.beforeEach(guard);

router.isReady().then(() => {
    guard(router.currentRoute.value);
    const entry = getEntity(activeTabId).value?.entry;
    if (!entry) pushNow(activeTabId.value);
});

onUnmounted(() => {
    removeRouterHook();
});
</script>

<style scoped></style>
