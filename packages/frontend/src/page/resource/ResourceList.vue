<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowUpRight, Eye, Plus, Tag } from '@lucide/vue';
import { useWorkbenchStore, stateTone, type Resource } from '@/module/workbench';
import { useWorkspaceStore } from '@/module/workspace';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { StateBadge } from '@/component/state-badge';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';
import ResourcePage from './ResourcePage.vue';
import ResourceFactList from './ResourceFactList.vue';

const props = defineProps<{
    title: string;
    kind: Resource['kind'];
    domain: string;
    icon: Component;
    fields: [string, string, number][];
    createLabel: string;
}>();
const workbench = useWorkbenchStore();
const workspace = useWorkspaceStore();
const route = useRoute();
const router = useRouter();
const rows = computed(() => workbench.currentResources.filter((item) => item.kind === props.kind));
const selectedId = ref<string | null>(null);
const selected = computed(() => rows.value.find((item) => item.id === selectedId.value));
const open = computed({
    get: () => !!selected.value,
    set: (value) => {
        if (!value) selectedId.value = null;
    },
});
const columns = computed<DataTableColumn<Resource>[]>(() => [
    { id: 'name', label: props.title, size: 300, icon: props.icon, value: (row) => row.name },
    { id: 'id', label: 'ID', size: 180, icon: Tag, value: (row) => row.id },
    ...props.fields.map(([id, label, size]) => ({ id, label, size, value: () => '—' })),
    { id: 'status', label: '状态', size: 120, value: (row) => row.status },
]);
watch(
    () => [route.query.resource, workspace.activeId],
    () => {
        selectedId.value = typeof route.query.resource === 'string' ? route.query.resource : null;
    },
    { immediate: true }
);
function fullDetail() {
    if (!selected.value) return;
    router.push(`/main/${props.domain}/detail/${encodeURIComponent(selected.value.id)}`);
    selectedId.value = null;
}
</script>
<template>
    <ResourcePage :label="title" layout="table">
        <template #actions>
            <Button disabled>
                <Plus aria-hidden="true" />
                {{ createLabel }}
            </Button>
        </template>
        <SheetInspector v-model:open="open" :title="selected?.name ?? title" description="资源摘要">
            <template #main>
                <DataTable
                    :data="rows"
                    :columns="columns"
                    :active-id="selectedId"
                    :search-label="`搜索${title}或 ID`"
                    :search-text="(row) => `${row.name} ${row.id} ${row.description}`"
                    :empty-text="workbench.busy ? '正在加载' : '暂无可用的资源摘要'"
                    :actions="[
                        {
                            id: 'detail',
                            label: '详情',
                            icon: Eye,
                            primary: true,
                            run: (row) => {
                                selectedId = row.id;
                            },
                        },
                    ]"
                >
                    <template #cell-name="{ row }">
                        <button
                            class="group flex w-full items-start gap-3 rounded-sm text-left after:absolute after:inset-0"
                            :aria-label="`查看${row.name}`"
                            @click="selectedId = row.id"
                        >
                            <component :is="icon" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                            <span class="min-w-0">
                                <span class="block font-medium group-hover:underline group-focus-visible:underline">
                                    {{ row.name }}
                                </span>
                                <span class="mt-1 block text-xs text-muted-foreground">{{ row.description }}</span>
                            </span>
                        </button>
                    </template>
                    <template #cell-status="{ row }">
                        <StateBadge :tone="stateTone(row.status)">{{ row.status }}</StateBadge>
                    </template>
                </DataTable>
            </template>
            <template v-if="selected">
                <ScrollSurface class="min-h-0 flex-1 scroll-smooth p-6">
                    <div class="@container space-y-6">
                        <h2 class="pr-6 text-lg font-semibold">{{ selected.name }}</h2>
                        <CopyableId :value="selected.id" label="资源 ID" />
                        <ResourceFactList
                            :fields="[
                                { label: '工作区', value: workspace.current?.name },
                                { label: '状态', value: selected.status },
                                { label: '说明', value: selected.description },
                            ]"
                        />
                    </div>
                </ScrollSurface>
                <div class="shrink-0 border-t p-6">
                    <Button class="w-full" @click="fullDetail">
                        <ArrowUpRight aria-hidden="true" />
                        打开完整详情
                    </Button>
                </div>
            </template>
        </SheetInspector>
    </ResourcePage>
</template>
