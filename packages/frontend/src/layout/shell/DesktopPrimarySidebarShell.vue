<template>
    <div class="h-full min-h-0 flex min-w-0">
        <div class="flex flex-col h-full min-h-0 w-60">
            <div class="shrink-0 m-2 space-y-2">
                <Popover>
                    <PopoverAnchor>
                        <PopoverTrigger as-child class="group/switcher">
                            <Button
                                size="lg"
                                variant="outline"
                                class="w-full h-auto p-3 bg-muted shadow-none border-none"
                            >
                                <div class="flex items-center justify-between h-full w-full">
                                    <div class="flex min-h-0 min-w-0 max-h-full items-center gap-1">
                                        <!-- <Building2 class="size-9 p-1.5 bg-primary rounded text-primary-foreground" stroke-width="1.5" /> -->
                                        <div
                                            class="size-10 bg-primary/95 rounded text-primary-foreground shrink-0 flex"
                                        >
                                            <span class="m-auto text-md">孙</span>
                                        </div>
                                        <div class="flex flex-col items-start justify-center min-w-0 ml-1">
                                            <span class="truncate w-full font-semibold">孙教授课题组321321321312</span>
                                            <span class="text-xs text-muted-foreground truncate w-full mt-1">
                                                广东医科大学32132132131313321
                                            </span>
                                        </div>
                                    </div>
                                    <!-- <ChevronDown stroke-width="1.5" /> -->
                                </div>
                            </Button>
                        </PopoverTrigger>
                    </PopoverAnchor>
                    <PopoverContent class="px-4 py-2" align="start">wow</PopoverContent>
                </Popover>
            </div>

            <ScrollArea type="auto" class="min-h-0 flex-1">
                <div class="relative m-2">
                    <Search
                        aria-hidden="true"
                        stroke-width="1.5"
                        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input class="pl-9 cursor-pointer bg-foreground/5 border-none" placeholder="搜索工作区或执行命令" />
                </div>
                <div class="flex flex-col gap-0.5 m-2">
                    <Button
                        v-for="(item, idx) in navigation"
                        :key="item.label"
                        class="data-[active=true]:bg-primary/5 data-[active=true]:text-primary"
                        variant="ghost"
                        :tooltip="item.label"
                        :data-active="useRoutePathMatch({ type: 'prefix', value: item.to }).value"
                        @click="$router.push(item.to)"
                    >
                        <div class="flex-1 flex min-w-0 items-center gap-2">
                            <component :is="item.icon" :class="item.class" v-bind="item.attrs" />
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
                    <CollapsibleContent class="collapsible-content">
                        <Button
                            v-for="(value, idx) in Array.from({ length: 10 })"
                            :key="idx"
                            class="w-full"
                            variant="ghost"
                            tooltip="Manba Out!"
                        >
                            <div class="flex flex-1 items-center">
                                <span>Manba Out!</span>
                            </div>
                        </Button>
                        <Button class="group/more w-full" variant="ghost" tooltip="查看更多">
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
                <Button class="w-full" variant="ghost" tooltip="管理中心">
                    <div class="flex items-center flex-1 gap-2">
                        <ShieldKeyhole class="size-5" stroke-width="1.5" />
                        <span>管理中心</span>
                    </div>
                </Button>
                <!-- <Button class="w-full" :tooltip="open ? '收起侧栏' : '展开侧栏'" variant="ghost" @click="toggleSidebar">
                    <div class="flex-1 flex items-center gap-2">
                        <PanelLeftClose v-if="open" class="size-5" stroke-width="1.5" />
                        <PanelLeftOpen v-else class="size-5" stroke-width="1.5" />
                        <span>{{ open ? '收起侧栏' : '展开侧栏' }}</span>
                    </div>
                </Button> -->
            </div>
        </div>
        <DesktopPrimaryContentShell class="flex-1 h-full">
            <RouterView />
        </DesktopPrimaryContentShell>
    </div>
</template>

<script setup lang="ts">
import { useRoutePathMatch } from '@/shared/composables';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/collapsible';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { ScrollArea } from '@/ui/scroll-area';
import { Separator } from '@/ui/separator';

import DesktopPrimaryContentShell from '@/layout/shell/DesktopPrimaryContentShell.vue';

import { ref } from 'vue';

import {
    Boxes,
    RobotArm,
    FlaskConical,
    LayoutDashboard,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    ShieldKeyhole,
    Building2,
    ArrowRight,
    ChevronRight,
    ChevronDown,
} from '@lucide/vue';

const navigation = [
    {
        type: 'navigation',
        label: '工作台',
        icon: LayoutDashboard,
        to: '/main/workbench',
        class: 'size-5',
        attrs: {
            strokeWidth: 1.5,
        },
    },
    {
        type: 'navigation',
        label: '材料',
        icon: FlaskConical,
        to: '/main/material',
        class: 'size-5',
        attrs: {
            strokeWidth: 1.5,
        },
    },
    {
        type: 'navigation',
        label: '库存',
        icon: Boxes,
        to: '/main/inventory',
        class: 'size-5',
        attrs: {
            strokeWidth: 1.5,
        },
    },
    {
        type: 'navigation',
        label: '设备',
        icon: RobotArm,
        to: '/main/equipment',
        class: 'size-5',
        attrs: {
            strokeWidth: 1.5,
        },
    },
];

const open = ref(true);

function toggleSidebar() {
    open.value = !open.value;
}
</script>

<style scoped>
.collapsible-content {
    overflow: hidden;
}

.collapsible-content[data-state='open'] {
    animation: collapsible-down 100ms var(--ease-standard);
}

.collapsible-content[data-state='closed'] {
    animation: collapsible-up 100ms var(--ease-standard);
}

@keyframes collapsible-down {
    from {
        height: 0;
        opacity: 0;
    }

    to {
        height: var(--reka-collapsible-content-height);
        opacity: 1;
    }
}

@keyframes collapsible-up {
    from {
        height: var(--reka-collapsible-content-height);
        opacity: 1;
    }

    to {
        height: 0;
        opacity: 0;
    }
}
</style>
