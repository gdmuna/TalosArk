<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, type RouteLocationRaw } from 'vue-router';
import { ArrowUpRight } from '@lucide/vue';
import type { Resource } from '@/module/workbench';
import { stateTone } from '@/module/workbench';
import { useWorkspaceStore } from '@/module/workspace';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import ResourceFactList from './ResourceFactList.vue';

const resource = defineModel<Resource | null>({ default: null });
const props = defineProps<{ detailTo?: RouteLocationRaw }>();
const router = useRouter();
const workspace = useWorkspaceStore();
const open = computed({
    get: () => !!resource.value,
    set: (value) => {
        if (!value) resource.value = null;
    },
});
function detail() {
    if (!props.detailTo) return;
    router.push(props.detailTo);
    resource.value = null;
}
</script>

<template>
    <SheetInspector v-model:open="open" :title="resource?.name ?? '资源预览'" description="资源摘要">
        <template v-if="$slots.main" #main><slot name="main" /></template>
        <template v-if="resource">
            <ScrollSurface class="min-h-0 flex-1 p-6 pt-10">
                <div class="@container space-y-6">
                    <h2 class="pr-6 text-lg font-semibold">{{ resource.name }}</h2>
                    <CopyableId :value="resource.id" label="资源 ID" />
                    <StateBadge :tone="stateTone(resource.status)">{{ resource.status }}</StateBadge>
                    <ResourceFactList
                        :fields="[
                            { label: '工作区', value: workspace.current?.name },
                            { label: '类型', value: resource.kind },
                            { label: '说明', value: resource.description },
                        ]"
                    />
                </div>
            </ScrollSurface>
            <div v-if="detailTo" class="shrink-0 border-t p-6">
                <Button class="w-full" @click="detail">
                    <ArrowUpRight aria-hidden="true" />
                    打开完整详情
                </Button>
            </div>
        </template>
    </SheetInspector>
</template>
