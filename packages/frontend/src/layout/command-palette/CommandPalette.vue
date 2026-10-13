<template>
    <Dialog v-model:open="open">
        <DialogContent
            :show-close-button="false"
            class="top-[16%] flex max-h-[75vh] translate-y-0 flex-col gap-0 p-0 sm:max-w-2xl"
            @close-auto-focus="restoreFocus"
        >
            <DialogTitle class="sr-only">搜索工作区或执行命令</DialogTitle>
            <DialogDescription class="sr-only">搜索材料定义、库存实例、设施、设备、页面与命令</DialogDescription>
            <Command
                @keydown.capture="prepareKeyboardScroll"
                @keyup.capture="finishKeyboardScroll"
                @focusout.capture="restoreKeyboardScroll"
            >
                <div class="relative shrink-0">
                    <CommandInput class="pr-9" placeholder="搜索工作区或执行命令" aria-label="搜索资源、页面或命令" />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        use-tooltip
                        class="absolute right-3 top-2.5"
                        title="关闭搜索"
                        aria-label="关闭搜索"
                        @click="open = false"
                    >
                        <X aria-hidden="true" />
                    </Button>
                </div>
                <ScrollSurface
                    ref="scrollSurface"
                    :edges="['top']"
                    edge-effect="line"
                    :focus-inset="focusInset"
                    class="max-h-[calc(75svh-3rem)] [--edge-surface:var(--card)]"
                >
                    <CommandList class="min-h-36 max-h-none overflow-visible p-2 pt-0" aria-label="搜索结果">
                        <CommandEmpty class="py-10 text-muted-foreground">没有找到匹配的资源、页面或命令</CommandEmpty>
                        <CommandGroup
                            v-for="group in groups"
                            :key="group.label"
                            :heading="group.label"
                            class="border-b py-2 last:border-none"
                        >
                            <CommandItem
                                v-for="result in group.items"
                                :key="result.id"
                                :value="result.id"
                                :text-value="result.label"
                                :keywords="[result.keywords, result.resource?.status ?? '']"
                                class="group/result min-h-8 gap-3 px-2.5"
                                :disabled="workbench.busy || (result.command === 'inspection' && !!workbench.syncError)"
                                @select="execute(result)"
                            >
                                <component :is="result.icon" class="size-4 shrink-0" aria-hidden="true" />
                                <span class="min-w-0 flex-1 truncate">{{ result.label }}</span>
                                <StateBadge v-if="result.resource" :tone="stateTone(result.resource.status)">
                                    {{ result.resource.status }}
                                </StateBadge>
                                <CornerDownLeft
                                    v-else
                                    class="size-3.5 text-muted-foreground opacity-0 group-data-highlighted/result:opacity-100"
                                    aria-hidden="true"
                                />
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </ScrollSurface>
            </Command>
            <p v-if="commandError" role="alert" class="px-3 py-2 text-sm text-destructive">{{ commandError }}</p>
        </DialogContent>
    </Dialog>
    <ResourceDialog v-model="preview" :return-focus="returnFocus" />
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, useTemplateRef, watch, type Component } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useRouter } from 'vue-router';
import {
    Building2,
    CornerDownLeft,
    FileText,
    FlaskConical,
    Monitor,
    PackageSearch,
    Package,
    Plus,
    X,
} from '@lucide/vue';
import { Button } from '@/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useWorkspaceStore } from '@/module/workspace';
import { useWorkbenchStore } from '@/module/workbench';
import { StateBadge } from '@/component/state-badge';
import { ResourceDialog } from '@/module/workbench/ui';
import { ScrollSurface } from '@/component/scroll-surface';
import { managementNavigation, managementPath } from '@/router/management-navigation';
import { resourceNavigation, type ResourceDomain } from '@/router/resource-navigation';
import { workbenchPage } from '@/module/workbench/navigation';
import { stateTone, type Resource } from '@/module/workbench';

type Result = {
    id: string;
    group: string;
    label: string;
    description: string;
    keywords: string;
    icon: Component;
    path?: string;
    resource?: Resource;
    command?: 'inspection';
};
const open = defineModel<boolean>({ default: false });
const preview = ref<Resource | null>(null);
const commandError = ref('');
const returnFocus = shallowRef<HTMLElement | null>(null);
const workspace = useWorkspaceStore();
const workbench = useWorkbenchStore();
const router = useRouter();
const focusInset = { top: 36, bottom: 36 };
const scrollSurface = useTemplateRef<InstanceType<typeof ScrollSurface>>('scrollSurface');
const navigationKeys = ['ArrowUp', 'ArrowDown', 'Home', 'End'];
let restoreViewportScroll: (() => void) | undefined;
function restoreKeyboardScroll() {
    restoreViewportScroll?.();
    restoreViewportScroll = undefined;
}
function prepareKeyboardScroll(event: KeyboardEvent) {
    if (event.isComposing || !navigationKeys.includes(event.key)) return;
    if (!event.repeat) return restoreKeyboardScroll();
    const viewport = scrollSurface.value?.viewportElement;
    if (!viewport || restoreViewportScroll) return;
    const previous = viewport.style.getPropertyValue('scroll-behavior');
    const priority = viewport.style.getPropertyPriority('scroll-behavior');
    // Apply before Reka's bubbling handler; a queued Vue update would miss this event.
    viewport.style.setProperty('scroll-behavior', 'auto', priority);
    restoreViewportScroll = () => {
        if (previous) viewport.style.setProperty('scroll-behavior', previous, priority);
        else viewport.style.removeProperty('scroll-behavior');
    };
}
function finishKeyboardScroll(event: KeyboardEvent) {
    if (navigationKeys.includes(event.key)) restoreKeyboardScroll();
}
useEventListener('blur', restoreKeyboardScroll);
onScopeDispose(restoreKeyboardScroll);
const pages: Result[] = [
    ...managementNavigation.flatMap((group) =>
        group.items.map((item) => ({
            id: `management-${item.path}`,
            group: '页面',
            label: `管理中心 · ${item.label}`,
            description: `管理中心 / ${group.label} / ${item.label}`,
            keywords: `管理中心 ${group.label} ${item.label}`,
            icon: item.icon,
            path: `${managementPath}/${item.path}`,
        }))
    ),
    ...Object.values(workbenchPage).map((page) => ({
        id: page.commandId,
        group: '页面',
        label: page.commandLabel,
        description: `工作台 / ${page.label === '概览' ? '总览' : page.label}`,
        keywords: page.keywords,
        icon: page.icon,
        path: page.path,
    })),
    ...(['material', 'inventory', 'equipment'] as ResourceDomain[]).flatMap((domain) => {
        const context = {
            material: { label: '材料', icon: FlaskConical, keywords: '耗材 化学试剂 生物材料 培养基 细胞' },
            inventory: { label: '库存', icon: PackageSearch, keywords: '台账 库存查询 存储' },
            equipment: { label: '设备', icon: Monitor, keywords: '冰箱 离心机' },
        }[domain];
        return resourceNavigation[domain].map((item) => ({
            id: `${domain}-${item.path}`,
            group: '页面',
            label: `${context.label} · ${item.label}`,
            description: `${context.label} / ${item.label}`,
            keywords: `${context.label} ${item.label} ${context.keywords}`,
            icon: context.icon,
            path: `/main/${domain}/${item.path}`,
        }));
    }),
];
const resourceIcons = { 材料定义: FlaskConical, 库存实例: Package, 设施: Building2, 设备: Monitor, 文件: FileText };
const candidates = computed(() => {
    const resourceItems: Result[] = workbench.currentResources.map((item) => ({
        id: item.id,
        group: item.kind,
        label: item.name,
        description: `${item.kind} · ${workspace.workspaces.find((entry) => entry.id === item.workspaceId)?.name} · ${item.description}`,
        keywords: `${item.name} ${item.id} ${item.description}`,
        icon: resourceIcons[item.kind],
        resource: item,
    }));
    const equipment = workbench.currentResources.filter((item) => item.kind === '设备');
    const commands: Result[] = equipment.map((item) => ({
        id: `inspection-${item.id}`,
        group: '命令',
        label: `新建${item.name}巡检任务`,
        description: workspace.current?.name ?? '',
        keywords: `${item.name} 新建 设备巡检任务`,
        icon: Plus,
        resource: undefined,
        command: 'inspection',
    }));
    return [...resourceItems, ...pages, ...commands];
});
const groups = computed(() =>
    ['材料定义', '库存实例', '设施', '设备', '文件', '页面', '命令']
        .map((label) => ({ label, items: candidates.value.filter((item) => item.group === label) }))
        .filter((group) => group.items.length)
);
watch(open, (value) => {
    restoreKeyboardScroll();
    if (value) {
        returnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        commandError.value = '';
    }
});
function restoreFocus(event: Event) {
    event.preventDefault();
    if (!open.value && !preview.value && returnFocus.value?.isConnected) returnFocus.value.focus();
}
async function execute(item: Result) {
    if (workbench.busy) return;
    if (item.resource) {
        open.value = false;
        preview.value = item.resource;
    } else if (item.command === 'inspection') {
        const resource = workbench.currentResources.find((entry) => `inspection-${entry.id}` === item.id);
        if (!resource) return;
        const id = await workbench.addInspection(resource);
        if (!id) {
            commandError.value = workbench.error;
            return;
        }
        open.value = false;
        router.push({ path: workbenchPage.task.path, query: { task: id } });
    } else if (item.path) {
        open.value = false;
        router.push(item.path);
    }
}
</script>
