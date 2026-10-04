<template>
    <Dialog v-model:open="open">
        <DialogContent
            :show-close-button="false"
            class="top-[16%] flex max-h-[75vh] translate-y-0 flex-col gap-0 p-0 sm:max-w-2xl"
            @close-auto-focus="restoreFocus"
        >
            <DialogTitle class="sr-only">搜索工作区或执行命令</DialogTitle>
            <DialogDescription class="sr-only">搜索材料定义、库存实例、设施、设备、页面与命令</DialogDescription>
            <Command>
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
                <ScrollSurface :edge-size="32" class="max-h-[calc(75svh-3rem)] [--edge-surface:var(--card)]">
                    <CommandList class="min-h-36 max-h-none overflow-visible p-2" aria-label="搜索结果">
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
                                :keywords="[result.keywords]"
                                class="group/result min-h-8 gap-3 px-2.5"
                                :disabled="workbench.busy"
                                @select="execute(result)"
                            >
                                <component
                                    :is="result.icon"
                                    class="size-4 shrink-0"
                                    stroke-width="1.5"
                                    aria-hidden="true"
                                />
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
import { computed, ref, shallowRef, watch, type Component } from 'vue';
import { useRouter } from 'vue-router';
import {
    ClipboardCheck,
    Building2,
    CornerDownLeft,
    FileText,
    FlaskConical,
    LayoutDashboard,
    ListTodo,
    Monitor,
    PackageSearch,
    Package,
    Plus,
    TriangleAlert,
    X,
} from '@lucide/vue';
import { Button } from '@/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useWorkspaceStore, useWorkbenchStore } from '@/shared/stores';
import StateBadge from '@/modules/state-badge/StateBadge.vue';
import ResourceDialog from '@/modules/workbench/ResourceDialog.vue';
import { ScrollSurface } from '@/modules/scroll-surface';
import { stateTone, type Resource } from '@/shared/models/workbench';

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
const pages: Result[] = [
    {
        id: 'overview',
        group: '页面',
        label: '工作台总览',
        description: '工作台 / 总览',
        keywords: '首页 工作台 总览',
        icon: LayoutDashboard,
        path: '/main/workbench/overview',
    },
    {
        id: 'tasks',
        group: '页面',
        label: '我的待办',
        description: '工作台 / 我的待办',
        keywords: '任务 待办 我的',
        icon: ListTodo,
        path: '/main/workbench/my-task',
    },
    {
        id: 'approvals',
        group: '页面',
        label: '待审批',
        description: '工作台 / 待审批',
        keywords: '审批 申请',
        icon: ClipboardCheck,
        path: '/main/workbench/pending-approval',
    },
    {
        id: 'alerts',
        group: '页面',
        label: '异常与提醒',
        description: '工作台 / 异常与提醒',
        keywords: '告警 异常 提醒',
        icon: TriangleAlert,
        path: '/main/workbench/exception-alert',
    },
    {
        id: 'materials',
        group: '页面',
        label: '材料列表',
        description: '材料 / 材料列表',
        keywords: '培养基 细胞 试剂 材料',
        icon: FlaskConical,
        path: '/main/material/list',
    },
    {
        id: 'equipment',
        group: '页面',
        label: '设备列表',
        description: '设备 / 设备列表',
        keywords: '设备 冰箱 离心机',
        icon: Monitor,
        path: '/main/equipment/list',
    },
    {
        id: 'inventory',
        group: '页面',
        label: '库存台账',
        description: '库存 / 台账',
        keywords: '库存 盘点 库存查询',
        icon: PackageSearch,
        path: '/main/inventory/ledger',
    },
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
        router.push({ path: '/main/workbench/my-task', query: { task: id } });
    } else if (item.path) {
        open.value = false;
        router.push(item.path);
    }
}
</script>
