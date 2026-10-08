<template>
    <div class="size-full min-h-0 min-w-0 flex">
        <div v-show="open" class="flex flex-col h-full min-h-0 w-60 shrink-0 bg-muted">
            <div class="shrink-0 m-2 space-y-2">
                <WorkspaceSwitcher />
                <Button
                    variant="ghost"
                    class="h-9 w-full justify-start gap-2 bg-accent px-3 font-normal text-muted-foreground"
                    @click="paletteOpen = true"
                >
                    <Search class="size-4" aria-hidden="true" />
                    <span class="min-w-0 flex-1 truncate text-left">搜索工作区或执行命令</span>
                </Button>
            </div>

            <ScrollArea type="auto" class="min-h-0 flex-1 [--edge-surface:var(--muted)]">
                <div class="flex flex-col gap-0.5 m-2">
                    <Button
                        v-for="(item, idx) in navigation"
                        :key="item.label"
                        class="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group"
                        variant="ghost"
                        :title="item.label"
                        :data-active="useRoutePathMatch({ type: 'prefix', value: item.to }).value"
                        @click="$router.push(item.to)"
                    >
                        <div class="flex-1 flex min-w-0 items-center gap-2">
                            <component :is="item.icon" class="size-5 fill-none" />
                            <span>{{ item.label }}</span>
                        </div>
                    </Button>
                </div>
                <Collapsible class="flex flex-col gap-0.5 m-2 group" default-open>
                    <CollapsibleTrigger as-child>
                        <Button class="min-w-0" variant="ghost">
                            <div class="flex items-center min-w-0 w-full text-muted-foreground gap-1">
                                <span class="truncate">最近访问</span>
                                <ChevronRight
                                    class="opacity-0 group-data-[state=closed]:opacity-100 group-data-[state=open]:rotate-90 group-hover:opacity-100 transition-[rotate,opacity] ease-standard"
                                />
                            </div>
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <Button
                            v-for="item in recentResources"
                            :key="item.id"
                            class="w-full justify-start"
                            variant="ghost"
                            :title="item.name"
                            @click="preview = item"
                        >
                            <div class="flex flex-1 items-center">
                                <span class="truncate">{{ item.name }}</span>
                            </div>
                        </Button>
                        <Button class="group/more w-full" variant="ghost" title="查看更多" @click="paletteOpen = true">
                            <div
                                class="flex flex-1 items-center justify-between text-muted-foreground font-normal gap-1"
                            >
                                <span>查看更多</span>
                                <ArrowRight
                                    class="opacity-0 -translate-x-0.5 group-hover/more:opacity-100 group-hover/more:translate-x-0 transition ease-standard"
                                />
                            </div>
                        </Button>
                    </CollapsibleContent>
                </Collapsible>
            </ScrollArea>
            <div class="shrink-0 m-2 mb-4 flex flex-col gap-0.5">
                <Button class="w-full" variant="ghost" title="管理中心">
                    <div class="flex items-center flex-1 gap-2">
                        <ShieldKeyhole class="size-5" />
                        <span>管理中心</span>
                    </div>
                </Button>
            </div>
        </div>
        <DesktopPrimaryContentShell
            class="flex-1 h-full"
            :section-label="activeNavigation?.label ?? '工作台'"
            :section-path="activeNavigation?.to ?? '/main/workbench'"
        >
            <RouterView />
        </DesktopPrimaryContentShell>
        <CommandPalette v-model="paletteOpen" />
        <ResourceDialog v-model="preview" />
    </div>
</template>

<script setup lang="ts">
import { useRoutePathMatch } from '@/platform/navigation';
import { useWorkbenchStore } from '@/module/workbench';
import type { Resource } from '@/module/workbench';
import { ResourceDialog } from '@/module/workbench/ui';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/collapsible';
import { Button } from '@/ui/button';
import { useSidebar } from '@/ui/sidebar';
import { ScrollSurface as ScrollArea } from '@/component/scroll-surface';

import DesktopPrimaryContentShell from '@/layout/shell/DesktopPrimaryContentShell.vue';
import { WorkspaceSwitcher } from '@/module/workspace/ui';
import { CommandPalette } from '@/layout/command-palette';
import { useEventListener } from '@vueuse/core';

import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

import {
    Package,
    Microscope,
    Shapes,
    LayoutDashboard,
    Search,
    ShieldKeyhole,
    ArrowRight,
    ChevronRight,
} from '@lucide/vue';

const navigation = [
    {
        type: 'navigation',
        label: '工作台',
        icon: LayoutDashboard,
        to: '/main/workbench',
    },
    {
        type: 'navigation',
        label: '材料',
        icon: Shapes,
        to: '/main/material',
    },
    {
        type: 'navigation',
        label: '库存',
        icon: Package,
        to: '/main/inventory',
    },
    {
        type: 'navigation',
        label: '设备',
        icon: Microscope,
        to: '/main/equipment',
    },
];

const { open } = useSidebar();
const paletteOpen = ref(false);
const workbench = useWorkbenchStore();
const preview = ref<Resource | null>(null);
const recentResources = computed(() =>
    workbench.overview.recentItems.flatMap((item) => workbench.resourceById.get(item.resourceId) ?? [])
);
const route = useRoute();
const activeNavigation = computed(() => navigation.find((item) => route.path.startsWith(`${item.to}/`)));

useEventListener('keydown', (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.isComposing) {
        event.preventDefault();
        paletteOpen.value = !paletteOpen.value;
    }
});
</script>
