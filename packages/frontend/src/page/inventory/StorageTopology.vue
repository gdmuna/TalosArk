<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueryCommand } from '@/platform/navigation';
import { Building2, Grid2X2, Network, Plus } from '@lucide/vue';
import { useWorkbenchStore } from '@/module/workbench';
import { useWorkspaceStore } from '@/module/workspace';
import { Button } from '@/ui/button';
import { ScrollSurface } from '@/component/scroll-surface';
import ResourcePage from '../resource/ResourcePage.vue';
import ResourceSection from '../resource/ResourceSection.vue';
import ResourceEmpty from '../resource/ResourceEmpty.vue';
import ResourceFactList from '../resource/ResourceFactList.vue';
const workbench = useWorkbenchStore();
const workspace = useWorkspaceStore();
const facilities = computed(() => workbench.currentResources.filter((item) => item.kind === '设施'));
const selectedId = ref<string | null>(null);
const mode = ref<'structure' | 'position'>('structure');
const selected = computed(() => facilities.value.find((item) => item.id === selectedId.value));
watch(
    () => workspace.activeId,
    () => {
        selectedId.value = null;
    }
);
useQueryCommand('resource', (id) => {
    selectedId.value = id;
});
</script>
<template>
    <ResourcePage label="存储浏览">
        <div class="grid min-h-[520px] min-w-0 gap-6 @4xl:grid-cols-[220px_minmax(0,1fr)_260px]">
            <aside aria-label="存储结构" class="min-w-0 border-b pb-5 @4xl:border-r @4xl:border-b-0 @4xl:pr-5">
                <div class="mb-4 flex items-center justify-between">
                    <h2 class="font-semibold">存储结构</h2>
                    <Button variant="ghost" size="icon-sm" use-tooltip title="添加存储节点" disabled>
                        <Plus aria-hidden="true" />
                    </Button>
                </div>
                <ScrollSurface class="max-h-[480px]">
                    <div class="space-y-1">
                        <Button
                            v-for="item in facilities"
                            :key="item.id"
                            variant="ghost"
                            class="h-auto min-h-10 w-full justify-start whitespace-normal text-left"
                            :class="{ 'bg-primary-soft text-primary': selectedId === item.id }"
                            :aria-pressed="selectedId === item.id"
                            @click="selectedId = item.id"
                        >
                            <Building2 class="shrink-0" aria-hidden="true" />
                            <span>{{ item.name }}</span>
                        </Button>
                        <p v-if="!facilities.length" class="p-2 text-sm text-muted-foreground">设施未加载</p>
                    </div>
                </ScrollSurface>
            </aside>
            <section aria-label="存储视图" class="flex min-w-0 flex-col gap-5">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <h2 class="font-semibold">{{ selected?.name ?? '存储视图' }}</h2>
                    <div class="inline-flex gap-1 rounded-md border p-1" role="group" aria-label="存储视图模式">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            use-tooltip
                            title="结构视图"
                            :aria-pressed="mode === 'structure'"
                            :class="{ 'bg-muted': mode === 'structure' }"
                            @click="mode = 'structure'"
                        >
                            <Network aria-hidden="true" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            use-tooltip
                            title="孔位视图"
                            :aria-pressed="mode === 'position'"
                            :class="{ 'bg-muted': mode === 'position' }"
                            @click="mode = 'position'"
                        >
                            <Grid2X2 aria-hidden="true" />
                        </Button>
                    </div>
                </div>
                <div class="flex min-h-80 flex-1 items-center justify-center rounded-md border bg-muted/20">
                    <ResourceEmpty
                        :text="
                            !selected
                                ? '选择存储节点'
                                : mode === 'position'
                                  ? '孔位布局与占用未加载'
                                  : '子节点与存储布局未加载'
                        "
                    />
                </div>
            </section>
            <aside
                class="min-w-0 border-t pt-5 @4xl:border-t-0 @4xl:border-l @4xl:pt-0 @4xl:pl-5"
                aria-label="存储节点详情"
            >
                <ResourceSection title="节点详情">
                    <ResourceFactList
                        v-if="selected"
                        :fields="[
                            { label: '名称', value: selected.name },
                            { label: '设施 ID', value: selected.id },
                            { label: '说明', value: selected.description },
                            { label: '容量' },
                            { label: '占用' },
                            { label: '绑定设备' },
                        ]"
                    />
                    <ResourceEmpty v-else text="尚未选择节点" />
                    <Button variant="outline" class="w-full" disabled>位置转移</Button>
                </ResourceSection>
            </aside>
        </div>
    </ResourcePage>
</template>
