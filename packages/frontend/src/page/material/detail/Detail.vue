<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FlaskConical, Plus, Pencil, ZoomIn, ZoomOut, Scan, Eye } from '@lucide/vue';
import { useWorkbenchStore, useResourcePreview, stateTone, type Resource } from '@/module/workbench';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import ResourcePreview from '../../resource/ResourcePreview.vue';
import { useResourceBreadcrumb } from '../../resource/useResourceBreadcrumb';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceViewNav from '../../resource/ResourceViewNav.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceFactList from '../../resource/ResourceFactList.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';
import ResourceTable from '../../resource/ResourceTable.vue';
import ResourceFile from '../../resource/ResourceFile.vue';
import { useResource } from '../../resource/useResource';
import { useResourceView } from '../../resource/useResourceView';
import { materialBranch } from '../useMaterialSummary';

const { resource, resourceId, workspace } = useResource('材料定义');
const router = useRouter();
const workbench = useWorkbenchStore();
const { returnTo } = useResourceBreadcrumb({
    domain: 'material',
    kind: '材料定义',
    listLabel: '材料列表',
    resource,
    resourceId,
});
const allTabs = [
    { id: 'overview', label: '概览' },
    { id: 'instance', label: '实例与库存' },
    { id: 'culture', label: '培养' },
    { id: 'lineage', label: '谱系' },
    { id: 'quality', label: '检验' },
    { id: 'file', label: '文件' },
    { id: 'activity', label: '动态' },
];
const supportsCulture = computed(
    () => resource.value?.material?.branch === 'biological' && resource.value.material.supportsCulture
);
const tabs = computed(() => allTabs.filter((tab) => !['culture', 'lineage'].includes(tab.id) || supportsCulture.value));
const { view: requestedView, select } = useResourceView(allTabs.map((tab) => tab.id));
const view = computed(() =>
    tabs.value.some((tab) => tab.id === requestedView.value) ? requestedView.value : 'overview'
);
const instances = computed(() =>
    resource.value
        ? workbench.currentResources.filter((item) => item.kind === '库存实例' && item.materialId === resourceId.value)
        : []
);
const { resource: selectedInstance } = useResourcePreview(ref<Resource | null>(null), instances, resourceId);
const instanceColumns: DataTableColumn<Resource>[] = [
    { id: 'name', label: '库存实例', size: 280, value: (row) => row.name },
    { id: 'id', label: '实例 ID', size: 180, value: (row) => row.id },
    { id: 'batch', label: '批次', size: 140, value: () => '—' },
    { id: 'position', label: '存储位置', size: 180, value: () => '—' },
    { id: 'status', label: '状态', size: 120, value: (row) => row.status },
    { id: 'received', label: '入库时间', size: 180, value: () => '—' },
];
function openInstance(item: Resource) {
    router.push(`/main/inventory/detail/${encodeURIComponent(item.id)}`);
}
</script>
<template>
    <ResourceDetailPage label="材料详情">
        <template #header>
            <ResourceObjectHeader
                :id="resourceId"
                :title="resource?.name ?? '材料详情'"
                :icon="FlaskConical"
                :status="resource?.status"
                :back-to="returnTo"
                back-label="材料列表"
            >
                <Button variant="outline" disabled>
                    <Pencil aria-hidden="true" />
                    编辑材料
                </Button>
                <Button disabled>
                    <Plus aria-hidden="true" />
                    登记实例
                </Button>
            </ResourceObjectHeader>
            <ResourceViewNav v-if="resource" :items="tabs" :active="view" label="材料详情视图" @select="select" />
        </template>
        <ResourceEmpty v-if="!resource" text="当前工作区未找到该材料" />
        <template v-else>
            <template v-if="view === 'overview'">
                <ResourceSection title="基本信息">
                    <ResourceFactList
                        :fields="[
                            { label: '材料名称', value: resource.name },
                            { label: '业务分支', value: materialBranch(resource)?.label },
                            { label: '材料类型', value: resource.material?.type },
                            { label: '制造商' },
                            { label: '目录编号' },
                            { label: '计量单位' },
                            { label: '负责人' },
                            { label: '工作区', value: workspace.current?.name },
                            { label: '创建时间' },
                            { label: '说明', value: resource.description },
                        ]"
                    />
                </ResourceSection>
                <div class="grid gap-8 @min-[1000px]:grid-cols-2">
                    <ResourceSection title="库存汇总">
                        <ResourceFactList
                            :fields="[
                                { label: '可用实例' },
                                { label: '已预留' },
                                { label: '存储位置' },
                                { label: '在库数量' },
                            ]"
                        />
                    </ResourceSection>
                    <ResourceSection title="近期动态"><ResourceEmpty text="材料动态未加载" /></ResourceSection>
                </div>
                <ResourceSection :title="supportsCulture ? '批次与 Cell Bank' : '批次'">
                    <ResourceTable
                        :fields="[
                            ['name', supportsCulture ? 'Cell Bank / Batch' : '批次', 260],
                            ['type', '类型', 120],
                            ['quality', '检验状态', 130],
                            ['available', '可用实例', 120],
                            ['created', '创建时间', 180],
                        ]"
                    />
                </ResourceSection>
            </template>
            <template v-else-if="view === 'instance'">
                <ResourceSection title="库存实例">
                    <DataTable
                        :data="instances"
                        :columns="instanceColumns"
                        :preview="
                            (row) => {
                                selectedInstance = row;
                            }
                        "
                        :actions="[
                            { id: 'detail', label: '详情', icon: Eye, primary: true, run: openInstance },
                            {
                                id: 'preview',
                                label: '预览',
                                icon: Eye,
                                run: (row) => {
                                    selectedInstance = row;
                                },
                            },
                        ]"
                        empty-text="暂无关联的库存实例摘要"
                    >
                        <template #cell-name="{ row }">
                            <Button
                                variant="ghost"
                                class="group h-auto w-full justify-start whitespace-normal p-0 text-left font-medium hover:bg-transparent after:absolute after:inset-0"
                                @click="selectedInstance = row"
                            >
                                <span class="group-hover:underline group-focus-visible:underline">{{ row.name }}</span>
                            </Button>
                        </template>
                        <template #cell-status="{ row }">
                            <StateBadge :tone="stateTone(row.status)">{{ row.status }}</StateBadge>
                        </template>
                    </DataTable>
                </ResourceSection>
                <ResourceSection title="批次">
                    <ResourceTable
                        :fields="[
                            ['id', 'Batch ID', 200],
                            ['bank', 'Cell Bank', 220],
                            ['quality', '质量状态', 130],
                            ['available', '可用数量', 120],
                        ]"
                    />
                </ResourceSection>
            </template>
            <template v-else-if="view === 'culture'">
                <ResourceSection title="培养物">
                    <template #actions>
                        <Button disabled>
                            <Plus aria-hidden="true" />
                            登记培养物
                        </Button>
                    </template>
                    <ResourceTable
                        :fields="[
                            ['id', '培养物 ID', 200],
                            ['passage', '代次', 90],
                            ['instance', '关联实例', 220],
                            ['status', '培养状态', 130],
                            ['position', '位置', 180],
                            ['updated', '最近事件', 180],
                        ]"
                    />
                </ResourceSection>
                <ResourceSection title="培养事件">
                    <ResourceTable
                        :fields="[
                            ['time', '时间', 180],
                            ['culture', '培养物', 200],
                            ['event', '事件', 160],
                            ['operator', '操作人', 120],
                        ]"
                    />
                </ResourceSection>
            </template>
            <template v-else-if="view === 'lineage'">
                <ResourceSection title="谱系">
                    <template #actions>
                        <div class="flex gap-1">
                            <Button variant="outline" size="icon-sm" use-tooltip title="缩小" disabled>
                                <ZoomOut aria-hidden="true" />
                            </Button>
                            <Button variant="outline" size="icon-sm" use-tooltip title="放大" disabled>
                                <ZoomIn aria-hidden="true" />
                            </Button>
                            <Button variant="outline" size="icon-sm" use-tooltip title="适应画布" disabled>
                                <Scan aria-hidden="true" />
                            </Button>
                        </div>
                    </template>
                    <div
                        class="flex min-h-[420px] w-[min(100cqw,72rem)] items-center justify-center rounded-md border bg-muted/20"
                    >
                        <ResourceEmpty text="谱系节点与关系未加载" />
                    </div>
                </ResourceSection>
                <ResourceSection title="节点详情"><ResourceEmpty text="选择谱系节点" /></ResourceSection>
            </template>
            <template v-else-if="view === 'quality'">
                <ResourceSection title="检验记录">
                    <template #actions>
                        <Button disabled>
                            <Plus aria-hidden="true" />
                            登记检验
                        </Button>
                    </template>
                    <ResourceTable
                        :fields="[
                            ['id', '检验 ID', 180],
                            ['project', '检验项目', 220],
                            ['object', '关联对象', 200],
                            ['result', '结果', 120],
                            ['date', '检验日期', 160],
                            ['owner', '检验人', 120],
                        ]"
                    />
                </ResourceSection>
                <ResourceSection title="检验详情"><ResourceEmpty text="选择检验记录" /></ResourceSection>
            </template>
            <ResourceFile v-else-if="view === 'file'" />
            <ResourceSection v-else title="材料动态">
                <ResourceTable
                    :fields="[
                        ['time', '时间', 180],
                        ['event', '事件', 260],
                        ['object', '关联对象', 220],
                        ['operator', '操作人', 120],
                    ]"
                />
            </ResourceSection>
        </template>
        <ResourcePreview
            v-model="selectedInstance"
            :detail-to="
                selectedInstance ? `/main/inventory/detail/${encodeURIComponent(selectedInstance.id)}` : undefined
            "
        />
    </ResourceDetailPage>
</template>
