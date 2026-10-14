<template>
    <div class="flex size-full min-h-0 min-w-0">
        <ApplicationSidebar
            :collapsed="!sidebarExpanded"
            :recent-resources="recentResources"
            @search="paletteOpen = true"
            @preview="preview = $event"
        />
        <DesktopPrimaryContentShell
            class="flex-1 h-full"
            :section-label="route.meta.sectionLabel ?? activeNavigation?.label ?? '工作台'"
            :section-path="route.meta.sectionPath ?? activeNavigation?.to ?? workbenchPath"
            :sidebar-expanded="sidebarExpanded"
            @toggle-sidebar="sidebarExpanded = !sidebarExpanded"
        >
            <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <RouterView v-slot="{ Component, route: pageRoute }">
                    <WorkspaceUnavailable v-if="pageRoute.meta.requiresWorkspace && !workspace.current" />
                    <div
                        v-else-if="Component"
                        :key="pageRoute.matched[1]?.path"
                        class="flex min-h-0 min-w-0 flex-1 flex-col"
                        data-slot="route-page"
                    >
                        <component :is="Component" />
                    </div>
                </RouterView>
            </div>
        </DesktopPrimaryContentShell>
        <CommandPalette v-model="paletteOpen" />
        <ResourceDialog v-model="preview" />
    </div>
</template>

<script setup lang="ts">
import { useWorkbenchStore, type Resource } from '@/module/workbench';
import { workbenchPath } from '@/module/workbench/navigation';
import { ResourceDialog } from '@/module/workbench/ui';
import { useWorkspaceStore } from '@/module/workspace';
import { matchesRoutePath } from '@/shared/util';
import DesktopPrimaryContentShell from './DesktopPrimaryContentShell.vue';
import ApplicationSidebar from '../sidebar/ApplicationSidebar.vue';
import { workspaceNavigation } from '../sidebar/navigation';
import { CommandPalette } from '../command-palette';
import WorkspaceUnavailable from '../startup/WorkspaceUnavailable.vue';
import { useEventListener } from '@vueuse/core';

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

// Keep the previous preference cookie while replacing the shadcn sidebar state.
const sidebarExpanded = ref(!document.cookie.split('; ').includes('sidebar_state=false'));
watch(sidebarExpanded, (value) => {
    document.cookie = `sidebar_state=${value}; path=/; max-age=${60 * 60 * 24 * 7}`;
});
const paletteOpen = ref(false);
const workbench = useWorkbenchStore();
const workspace = useWorkspaceStore();
const preview = ref<Resource | null>(null);
const recentResources = computed(() =>
    workbench.overview.recentItems.flatMap((item) => workbench.resourceById.get(item.resourceId) ?? [])
);
const route = useRoute();
const activeNavigation = computed(() =>
    workspaceNavigation.find((item) => matchesRoutePath(route.path, { type: 'prefix', value: item.to }))
);

useEventListener('keydown', (event: KeyboardEvent) => {
    if ((!event.ctrlKey && !event.metaKey) || event.isComposing || event.repeat || event.altKey) return;
    if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        paletteOpen.value = !paletteOpen.value;
    } else if (event.key.toLowerCase() === 'b') {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return;
        event.preventDefault();
        sidebarExpanded.value = !sidebarExpanded.value;
    }
});
</script>
