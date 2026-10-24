<template>
    <RouterTabBar>
        <template v-if="workbench.loaded && isOverview" #actions>
            <DropdownMenu>
                <DropdownMenuTrigger as-child>
                    <Button type="button" class="h-10 gap-3 px-4 text-base shadow-none">
                        新建
                        <Plus aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-44">
                    <DropdownMenuLabel>新建</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                        <FlaskConical aria-hidden="true" />
                        新建材料
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                        <Wrench aria-hidden="true" />
                        新建设备
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                        <ListTodo aria-hidden="true" />
                        新建任务
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </template>
    </RouterTabBar>
    <ScrollArea type="auto" class="min-h-0 flex-1 scroll-smooth">
        <RouterView v-if="(workbench.loaded || isOverview || isApproval) && (!isApproval || approvalContextReady)" />
        <main
            v-else-if="isApproval"
            class="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-sm"
            role="status"
        >
            <p
                v-if="approvalContextError || selectingContext"
                :class="approvalContextError ? 'text-destructive' : 'text-muted-foreground'"
            >
                {{ approvalContextError || '正在核对申请所属工作区' }}
            </p>
            <Button v-if="!selectingContext" variant="outline" @click="resolveApprovalContext">重新加载</Button>
        </main>
        <WorkbenchQueueUnavailable v-else />
    </ScrollArea>
</template>

<script setup lang="ts">
import { RouterTabBar, useRouteTab } from '@/component/route-tab';
import { Button } from '@/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { ScrollSurface as ScrollArea } from '@/component/scroll-surface';
import { FlaskConical, ListTodo, Plus, Wrench } from '@lucide/vue';
import { useRoute, useRouter } from 'vue-router';
import { computed, ref, watch, onScopeDispose } from 'vue';
import { useWorkspaceStore } from '@/module/workspace';
import { workbenchPage } from '@/module/workbench/navigation';
import { useWorkbenchStore } from '@/module/workbench';
import { WorkbenchQueueUnavailable } from '@/module/workbench/ui';

const route = useRoute();
const router = useRouter();
const workspace = useWorkspaceStore();
const isOverview = computed(() => route.matched.at(-1)?.path === workbenchPage.overview.path);
const isApproval = computed(
    () =>
        route.path.startsWith('/main/workbench/request/') ||
        [workbenchPage.task.path, workbenchPage.approval.path].some((path) => path === route.path)
);
const workbench = useWorkbenchStore();
const approvalContextReady = ref(false),
    approvalContextError = ref('');
const selectingContext = ref(false);
let contextGeneration = 0;
async function resolveApprovalContext() {
    const generation = ++contextGeneration;
    approvalContextReady.value = false;
    approvalContextError.value = '';
    selectingContext.value = false;
    if (!isApproval.value) return;
    const current = workspace.current;
    if (!current) {
        approvalContextError.value = '当前没有可进入的工作区';
        return;
    }
    const organizationId = route.query.organization,
        workspaceId = route.query.workspace;
    if (organizationId === undefined && workspaceId === undefined) {
        await router.replace({
            query: { ...route.query, organization: current.organizationId, workspace: current.id },
        });
        return;
    }
    const target = workspace.workspaces.find(
        (item) => item.id === workspaceId && item.organizationId === organizationId
    );
    if (!target) {
        approvalContextError.value = '申请所属工作区不存在，或当前账户无权进入';
        return;
    }
    selectingContext.value = true;
    try {
        const error =
            current.id === target.id && current.organizationId === target.organizationId
                ? ''
                : await workspace.select(target.id);
        if (generation !== contextGeneration) return;
        approvalContextReady.value = error === '';
        approvalContextError.value = error ?? '';
    } finally {
        if (generation === contextGeneration) selectingContext.value = false;
    }
}
watch(
    [() => route.path, () => route.query.organization, () => route.query.workspace, () => workspace.workspaces],
    resolveApprovalContext,
    { immediate: true, flush: 'sync' }
);
watch(
    () => workspace.current,
    (current, previous) => {
        if (!isApproval.value || selectingContext.value || !current || current.id === previous?.id) return;
        void router.replace({ query: { ...route.query, organization: current.organizationId, workspace: current.id } });
    },
    { flush: 'sync' }
);
onScopeDispose(() => {
    contextGeneration++;
});
const { setEntity } = useRouteTab();

setEntity(
    Object.values(workbenchPage).map((page) => ({
        id: page.id,
        value: { disabled: false, label: page.label, path: page.path },
    }))
);
</script>

<style scoped></style>
