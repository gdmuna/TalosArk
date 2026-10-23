<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Material } from '@talos-ark/contracts/material';
import { useRoute } from 'vue-router';
import { Archive, ArchiveRestore, FlaskConical, Pencil, Boxes, Clock, Tag, ArrowRight } from '@lucide/vue';
import {
    useMaterialRead,
    useMaterialStore,
    useMaterialDataSource,
    materialErrorMessage,
    MaterialFacts,
    MaterialEditor,
    MaterialBatchList,
    MaterialAttachmentList,
    branchPresentation,
} from '@/module/material';
import { useWorkspaceStore } from '@/module/workspace';
import {
    useInventoryDataSource,
    useInventoryRead,
    useInventoryScope,
    InventoryStockInspector,
    inventoryStatusLabel,
} from '@/module/inventory';
import { Button } from '@/ui/button';
import MaterialInventoryPanel from './MaterialInventoryPanel.vue';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceViewNav from '../../resource/ResourceViewNav.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';
import { useResourceView } from '../../resource/useResourceView';
import { useResourceBreadcrumb } from '../../resource/useResourceBreadcrumb';

const route = useRoute(),
    store = useMaterialStore();
const materialSource = useMaterialDataSource();
const workspace = useWorkspaceStore();
const id = computed(() => String(route.params.resourceId));
const { data, loading, error, failure, reload } = useMaterialRead(
    (context, signal) => context.source.get(context.scope, id.value, signal),
    [id]
);
const material = computed(() => data.value?.material);
const tabs = [
    { id: 'overview', label: '概览' },
    { id: 'instance', label: '实例与库存' },
    { id: 'batch', label: '来源批次' },
    { id: 'file', label: '文件' },
    { id: 'activity', label: '动态' },
];
const { view, select } = useResourceView(tabs.map((item) => item.id));
const inventorySource = useInventoryDataSource();
const inventoryScope = useInventoryScope();
const inventory = useInventoryRead(
    computed(() =>
        view.value === 'overview' && inventoryScope.value ? JSON.stringify([inventoryScope.value, id.value]) : ''
    ),
    (scope, signal) =>
        inventorySource
            ? inventorySource.list(scope, { materialId: id.value, page: 1, pageSize: 10, q: '' }, signal)
            : Promise.reject(new Error('库存数据源未连接'))
);
const inventoryData = computed(() => inventory.data.value);
const inventoryRows = computed(() => inventoryData.value?.items ?? []);
const inventoryLoading = computed(() => inventory.loading.value);
const inventoryError = computed(() => inventory.error.value);
const inventoryPreviewId = ref('');
watch([id, inventoryScope], () => {
    inventoryPreviewId.value = '';
});
const editorOpen = ref(false);
const editing = ref<Material>();
function edit() {
    editing.value = material.value;
    editorOpen.value = !!editing.value;
}
async function searchMaterials(query: string, page: number, signal: AbortSignal) {
    const scope = store.scope;
    if (!scope) return { items: [], total: 0 };
    try {
        const result = await materialSource.list(
            scope,
            {
                page,
                pageSize: 20,
                q: query,
                state: 'all',
                sort: 'name:asc',
            },
            signal
        );
        const current = material.value ? { id: material.value.id, name: material.value.name } : undefined;
        const items = result.items.map((item) => ({ id: item.id, name: item.name }));
        const normalizedQuery = query.trim().toLocaleLowerCase();
        const currentMatches =
            !normalizedQuery ||
            current?.name.toLocaleLowerCase().includes(normalizedQuery) ||
            current?.id.toLocaleLowerCase().includes(normalizedQuery);
        if (page === 1 && current && currentMatches && !items.some((item) => item.id === current.id))
            items.unshift(current);
        return { items, total: result.total };
    } catch (cause) {
        throw new Error(materialErrorMessage(cause), { cause });
    }
}
watch(data, (value) => {
    if (value) store.capabilities = value.capabilities;
});
const { returnTo } = useResourceBreadcrumb({
    domain: 'material',
    kind: '材料定义',
    listLabel: '材料列表',
    resource: computed(() => (material.value ? { name: material.value.name } : undefined)),
    resourceId: id,
    search: searchMaterials,
});
</script>
<template>
    <ResourceDetailPage label="材料详情">
        <template #header>
            <ResourceObjectHeader
                :id="id"
                :title="material?.name ?? '材料详情'"
                :icon="FlaskConical"
                :subtitle="
                    material
                        ? [material.code, branchPresentation(material.branch).label, material.type.name]
                              .filter(Boolean)
                              .join(' · ')
                        : undefined
                "
                :status="material ? (material.archivedAt ? '已归档' : '有效') : undefined"
                :status-tone="material?.archivedAt ? 'neutral' : 'success'"
                :back-to="returnTo"
                back-label="材料列表"
            >
                <Button
                    variant="outline"
                    :disabled="!data?.capabilities.update || !material || !!material.archivedAt || store.busy"
                    @click="edit"
                >
                    <Pencil />
                    编辑材料
                </Button>
                <template v-if="material" #summary>
                    <dl class="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                        <div class="flex items-center gap-2">
                            <dt class="text-muted-foreground">所属工作区</dt>
                            <dd>{{ workspace.current?.name }}</dd>
                        </div>
                        <div class="flex items-center gap-2">
                            <dt class="text-muted-foreground">登记实例</dt>
                            <dd class="tabular-nums">{{ material.instanceCount }}</dd>
                        </div>
                        <div class="flex items-center gap-2">
                            <dt class="text-muted-foreground">计量单位</dt>
                            <dd>{{ material.quantityUnit }}</dd>
                        </div>
                    </dl>
                </template>
                <Button
                    variant="outline"
                    :disabled="
                        !data?.capabilities.archive ||
                        !material ||
                        store.busy ||
                        (!!material?.archivedAt && !!material?.type.archivedAt)
                    "
                    @click="material && store.archive(material)"
                >
                    <component :is="material?.archivedAt ? ArchiveRestore : Archive" />
                    {{ material?.archivedAt ? '恢复材料' : '归档材料' }}
                </Button>
            </ResourceObjectHeader>
            <ResourceViewNav v-if="material" :items="tabs" :active="view" label="材料详情视图" @select="select" />
        </template>
        <div v-if="error" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <p class="text-sm text-destructive">{{ error }}</p>
            <Button variant="outline" @click="reload">重新加载</Button>
        </div>
        <ResourceEmpty v-if="loading && !material" text="正在加载材料" />
        <ResourceEmpty v-else-if="!material" :text="error ? '材料加载失败' : '当前工作区没有可访问的材料'" />
        <template v-else>
            <p v-if="store.error" role="alert" class="text-sm text-destructive">{{ store.error }}</p>
            <div
                v-if="view === 'overview'"
                class="grid min-w-0 gap-8 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            >
                <div class="min-w-0 space-y-7">
                    <MaterialFacts :material="material" />
                </div>
                <aside class="min-w-0 space-y-7">
                    <ResourceSection title="登记实例">
                        <div class="flex items-center gap-4 py-2">
                            <Boxes class="size-6 text-primary" />
                            <span class="text-3xl font-semibold tabular-nums">{{ material.instanceCount }}</span>
                        </div>
                        <Button variant="outline" class="w-full" @click="select('instance')">查看实例与库存</Button>
                    </ResourceSection>
                    <ResourceSection title="最近入库实例">
                        <p v-if="inventoryLoading && !inventoryData" class="py-4 text-sm text-muted-foreground">
                            正在读取库存实例
                        </p>
                        <div v-else-if="inventoryError" class="space-y-2 text-sm">
                            <p class="text-destructive">{{ inventoryError }}</p>
                            <Button variant="outline" size="sm" @click="inventory.refresh">重新加载</Button>
                        </div>
                        <p v-else-if="!inventoryRows.length" class="py-4 text-sm text-muted-foreground">
                            暂无可访问的库存实例
                        </p>
                        <ul v-else class="divide-y">
                            <li v-for="item in inventoryRows.slice(0, 3)" :key="item.id">
                                <button
                                    class="group flex w-full min-w-0 items-center justify-between gap-3 py-3 text-left"
                                    @click="inventoryPreviewId = item.id"
                                >
                                    <span class="min-w-0">
                                        <span class="block truncate text-sm font-medium group-hover:underline">
                                            {{ item.code }}
                                        </span>
                                        <span class="mt-1 block text-xs text-muted-foreground">
                                            {{ inventoryStatusLabel[item.status] }}
                                        </span>
                                    </span>
                                    <span class="shrink-0 text-sm tabular-nums">
                                        {{ item.quantity }} {{ item.quantityUnit }}
                                    </span>
                                </button>
                            </li>
                        </ul>
                    </ResourceSection>
                    <ResourceSection title="所属工作区">
                        <p class="text-sm">{{ workspace.current?.name }}</p>
                    </ResourceSection>
                    <ResourceSection title="相关信息">
                        <div class="divide-y">
                            <Button
                                variant="ghost"
                                class="h-12 w-full justify-start rounded-none px-0"
                                @click="select('file')"
                            >
                                <Tag />
                                材料附件
                            </Button>
                            <Button
                                variant="ghost"
                                class="h-12 w-full justify-start rounded-none px-0"
                                @click="select('activity')"
                            >
                                <Clock />
                                材料动态
                            </Button>
                        </div>
                    </ResourceSection>
                </aside>
                <ResourceSection title="来源批次" class="@min-[1000px]:col-span-2">
                    <template #actions>
                        <Button variant="ghost" size="sm" @click="select('batch')">
                            查看全部
                            <ArrowRight aria-hidden="true" />
                        </Button>
                    </template>
                    <MaterialBatchList :material-id="id" :archived="!!material.archivedAt" />
                </ResourceSection>
            </div>
            <MaterialInventoryPanel
                v-else-if="view === 'instance'"
                :material="material"
                :on-committed="reload"
                :sync-failure="failure"
            />
            <ResourceSection v-else-if="view === 'batch'" title="来源批次">
                <MaterialBatchList :material-id="id" :archived="!!material.archivedAt" />
            </ResourceSection>
            <MaterialAttachmentList
                v-else-if="view === 'file'"
                :material-id="id"
                :can-manage="!!data?.capabilities.update && !material.archivedAt"
            />
            <ResourceSection v-else title="材料动态"><ResourceEmpty text="动态查询尚未接入" /></ResourceSection>
        </template>
        <MaterialEditor v-model:open="editorOpen" :material="editing" />
        <InventoryStockInspector v-model:id="inventoryPreviewId" />
    </ResourceDetailPage>
</template>
