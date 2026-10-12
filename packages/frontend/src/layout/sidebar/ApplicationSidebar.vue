<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { unrefElement } from '@vueuse/core';
import { ArrowLeft, ArrowRight, Clock3, Search, ShieldKeyhole } from '@lucide/vue';
import { matchesRoutePath } from '@/shared/util';
import type { Resource } from '@/module/workbench';
import { WorkspaceSwitcher } from '@/module/workspace/ui';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';
import { managementPath } from '@/router/management-navigation';
import { workbenchPage } from '@/module/workbench/navigation';
import { managementNavigation, workspaceNavigation } from './navigation';
import SidebarButton from './SidebarButton.vue';
import SidebarCollapsible from './SidebarCollapsible.vue';

defineProps<{ collapsed: boolean; recentResources: Resource[] }>();
const emit = defineEmits<{ search: []; preview: [resource: Resource] }>();
const route = useRoute();
const router = useRouter();
const page = ref<'workspace' | 'management'>('workspace');
let workspacePath: string = workbenchPage.overview.path;
let lastManagementPath = managementPath;
watch(
    () => route.fullPath,
    (path) => {
        const management = route.meta.sectionPath === managementPath;
        page.value = management ? 'management' : 'workspace';
        if (management) lastManagementPath = path;
        else workspacePath = path;
    },
    { immediate: true }
);
const isManagement = computed(() => page.value === 'management');
const managementTrigger = useTemplateRef('managementTrigger');
const returnTrigger = useTemplateRef('returnTrigger');

async function switchPage(value: typeof page.value) {
    await router.push(value === 'management' ? lastManagementPath : workspacePath);
    await nextTick();
    unrefElement(value === 'management' ? returnTrigger : managementTrigger)?.focus({ preventScroll: true });
}
</script>

<template>
    <aside
        id="application-sidebar"
        aria-label="应用侧栏"
        data-slot="application-sidebar"
        :data-collapsed="collapsed"
        class="application-sidebar flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-muted"
    >
        <div class="m-2 shrink-0 space-y-2">
            <WorkspaceSwitcher :compact="collapsed" @manage="router.push(`${managementPath}/workspace`)" />
            <SidebarButton
                class="h-9 bg-accent font-normal text-muted-foreground"
                :collapsed="collapsed"
                :icon="Search"
                label="搜索工作区或执行命令"
                @click="emit('search')"
            >
                <template #icon><Search class="size-4" aria-hidden="true" /></template>
            </SidebarButton>
        </div>

        <div class="min-h-0 flex-1 overflow-hidden">
            <div class="sidebar-pages" :data-page="page">
                <section class="sidebar-page" aria-label="工作区导航" :aria-hidden="isManagement" :inert="isManagement">
                    <ScrollSurface edge-effect="line" class="min-h-0 flex-1 [--edge-surface:var(--muted)]">
                        <nav aria-label="工作区" class="m-2 flex flex-col gap-0.5">
                            <SidebarButton
                                v-for="item in workspaceNavigation"
                                :key="item.to"
                                class="data-[active=true]:bg-primary/5 data-[active=true]:text-primary"
                                :collapsed="collapsed"
                                :icon="item.icon"
                                :label="item.label"
                                :aria-current="
                                    matchesRoutePath(route.path, { type: 'prefix', value: item.to })
                                        ? 'page'
                                        : undefined
                                "
                                :data-active="matchesRoutePath(route.path, { type: 'prefix', value: item.to })"
                                @click="$router.push(item.to)"
                            />
                        </nav>
                        <SidebarCollapsible class="m-2" :collapsed="collapsed" label="最近访问" :icon="Clock3">
                            <template #default="{ close }">
                                <Button
                                    v-for="item in recentResources"
                                    :key="item.id"
                                    variant="ghost"
                                    class="w-full justify-start"
                                    :title="item.name"
                                    :aria-label="item.name"
                                    @click="
                                        close();
                                        emit('preview', item);
                                    "
                                >
                                    <div class="flex flex-1 items-center min-w-0">
                                        <span class="truncate">{{ item.name }}</span>
                                    </div>
                                </Button>
                                <Button
                                    variant="ghost"
                                    class="group/more w-full pl-3"
                                    title="查看更多"
                                    aria-label="查看更多"
                                    @click="
                                        close();
                                        emit('search');
                                    "
                                >
                                    <div
                                        class="flex flex-1 items-center justify-between text-muted-foreground font-normal gap-1"
                                    >
                                        <span>查看更多</span>
                                        <ArrowRight
                                            class="opacity-0 -translate-x-0.5 group-hover/more:opacity-100 group-hover/more:translate-x-0 transition ease-standard"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </Button>
                            </template>
                        </SidebarCollapsible>
                    </ScrollSurface>
                    <div class="m-2 mb-4 shrink-0">
                        <SidebarButton
                            ref="managementTrigger"
                            :collapsed="collapsed"
                            :icon="ShieldKeyhole"
                            label="管理中心"
                            @click="switchPage('management')"
                        />
                    </div>
                </section>

                <section
                    class="sidebar-page"
                    aria-label="管理中心导航"
                    :aria-hidden="!isManagement"
                    :inert="!isManagement"
                >
                    <ScrollSurface edge-effect="line" class="min-h-0 flex-1 [--edge-surface:var(--muted)]">
                        <nav aria-label="管理中心" class="m-2 space-y-3">
                            <div v-for="group in managementNavigation" :key="group.label" class="space-y-0.5">
                                <div
                                    v-if="group.label"
                                    class="grid transition-[grid-template-rows,opacity] duration-(--sidebar-transition-duration) ease-standard"
                                    :class="collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'"
                                    :aria-hidden="collapsed"
                                >
                                    <div class="min-h-0 overflow-hidden">
                                        <h3 class="px-2.5 pb-1 text-muted-foreground">{{ group.label }}</h3>
                                    </div>
                                </div>
                                <SidebarButton
                                    v-for="item in group.items"
                                    :key="item.path"
                                    class="data-[active=true]:bg-primary/5 data-[active=true]:text-primary"
                                    :collapsed="collapsed"
                                    :icon="item.icon"
                                    :label="item.label"
                                    :tooltip="`${item.label}`"
                                    :data-active="route.path === `${managementPath}/${item.path}`"
                                    :aria-current="route.path === `${managementPath}/${item.path}` ? 'page' : undefined"
                                    @click="router.push(`${managementPath}/${item.path}`)"
                                />
                            </div>
                        </nav>
                    </ScrollSurface>
                    <div class="m-2 mb-4 shrink-0">
                        <SidebarButton
                            ref="returnTrigger"
                            :collapsed="collapsed"
                            :icon="ArrowLeft"
                            label="返回工作区"
                            @click="switchPage('workspace')"
                        />
                    </div>
                </section>
            </div>
        </div>
    </aside>
</template>

<style scoped>
.application-sidebar {
    width: 240px;
    transition: width var(--sidebar-transition-duration, 240ms) var(--ease-standard);
}

.application-sidebar[data-collapsed='true'] {
    width: 56px;
}

.sidebar-pages {
    display: flex;
    width: 200%;
    height: 100%;
    transition: transform 280ms var(--ease-standard);
}

.sidebar-pages[data-page='management'] {
    transform: translateX(-50%);
}

.sidebar-page {
    display: flex;
    flex: 0 0 50%;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
}
</style>
