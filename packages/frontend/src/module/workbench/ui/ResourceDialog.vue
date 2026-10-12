<template>
    <Dialog v-model:open="open">
        <DialogContent v-if="resource" class="sm:max-w-lg" @close-auto-focus="restoreFocus">
            <DialogTitle class="pr-8">{{ resource.name }}</DialogTitle>
            <CopyableId :value="resource.id" label="资源 ID" />
            <DialogDescription>{{ resource.kind }}</DialogDescription>
            <dl class="grid grid-cols-[5rem_1fr] gap-x-4 gap-y-4 border-y py-5">
                <dt class="text-muted-foreground">工作区</dt>
                <dd>{{ workspace.workspaces.find((item) => item.id === resource?.workspaceId)?.name }}</dd>
                <dt class="text-muted-foreground">状态</dt>
                <dd>
                    <StateBadge :tone="stateTone(resource.status)">{{ resource.status }}</StateBadge>
                </dd>
                <dt class="text-muted-foreground">说明</dt>
                <dd class="leading-6">{{ resource.description }}</dd>
            </dl>
            <div class="flex justify-end">
                <Button @click="openList">
                    <ArrowUpRight aria-hidden="true" />
                    查看{{ resource.kind === '文件' ? '设备' : resource.kind }}列表
                </Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
<script setup lang="ts">
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowUpRight } from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { StateBadge } from '@/component/state-badge';
import { CopyableId } from '@/component/inspector';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { stateTone, type Resource } from '../model/workbench';
import { useWorkbenchStore } from '../model/store';
import { useResourcePreview } from '../model/resource-preview';

const selection = defineModel<Resource | null>({ default: null });
const props = defineProps<{ returnFocus?: HTMLElement | null }>();
const workspace = useWorkspaceStore();
const workbench = useWorkbenchStore();
const { resource, open } = useResourcePreview(selection, () => workbench.currentResources);
const router = useRouter();
let previousFocus: HTMLElement | null = null;
watch(open, (value) => {
    if (value) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
});
function restoreFocus(event: Event) {
    const target = props.returnFocus ?? previousFocus;
    if (target?.isConnected) {
        event.preventDefault();
        target.focus();
    }
}
function openList() {
    const item = resource.value;
    if (!item) return;
    router.push({
        path:
            item.kind === '材料定义'
                ? '/main/material/list'
                : item.kind === '库存实例'
                  ? '/main/inventory/ledger'
                  : item.kind === '设施'
                    ? '/main/inventory/storage-topology'
                    : '/main/equipment/list',
        query: { resource: item.id },
    });
    resource.value = null;
}
</script>
