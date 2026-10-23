<template>
    <SheetInspector
        v-model:open="open"
        :title="resource?.name ?? '资源预览'"
        description="资源基本事实"
        :return-focus="returnFocus"
    >
        <ScrollSurface class="min-h-0 flex-1">
            <div v-if="resource" class="space-y-5 p-6 pr-10">
                <header class="space-y-2">
                    <h2 class="break-words text-lg font-semibold">{{ resource.name }}</h2>
                    <CopyableId :value="resource.id" label="资源 ID" />
                    <p class="text-sm text-muted-foreground">{{ resource.kind }}</p>
                </header>
                <dl class="grid grid-cols-[5rem_1fr] gap-x-4 gap-y-4 border-y py-5">
                    <dt class="text-muted-foreground">工作区</dt>
                    <dd class="min-w-0 break-words">
                        {{ workspace.workspaces.find((item) => item.id === resource?.workspaceId)?.name }}
                    </dd>
                    <dt class="text-muted-foreground">状态</dt>
                    <dd>
                        <StateBadge :tone="stateTone(resource.status)">{{ resource.status }}</StateBadge>
                    </dd>
                    <dt class="text-muted-foreground">说明</dt>
                    <dd class="min-w-0 break-words leading-6">{{ resource.description }}</dd>
                </dl>
            </div>
        </ScrollSurface>
        <div v-if="resource && (resource.kind !== '文件' || resource.materialId)" class="shrink-0 border-t p-6">
            <Button class="w-full" @click="openList">
                <ArrowUpRight aria-hidden="true" />
                {{ resource.kind === '文件' ? '查看所属材料' : `查看${resource.kind}列表` }}
            </Button>
        </div>
    </SheetInspector>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ArrowUpRight } from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { StateBadge } from '@/component/state-badge';
import { CopyableId, SheetInspector } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';
import { stateTone, type Resource } from '../model/workbench';
import { useWorkbenchStore } from '../model/store';
import { useResourcePreview } from '../model/resource-preview';

const selection = defineModel<Resource | null>({ default: null });
defineProps<{ returnFocus?: HTMLElement | null }>();
const workspace = useWorkspaceStore();
const workbench = useWorkbenchStore();
const { resource, open } = useResourcePreview(selection, () => workbench.currentResources);
const router = useRouter();
function openList() {
    const item = resource.value;
    if (!item) return;
    if (item.kind === '文件') {
        if (!item.materialId) return;
        void router.push({
            path: `/main/material/detail/${encodeURIComponent(item.materialId)}`,
            query: { view: 'file' },
        });
        resource.value = null;
        return;
    }
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
