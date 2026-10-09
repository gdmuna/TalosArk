<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Package, ArrowUpRight, ArrowLeftRight, LockKeyhole } from '@lucide/vue';
import { useWorkbenchStore } from '@/module/workbench';
import { Button } from '@/ui/button';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import { useResourceBreadcrumb } from '../../resource/useResourceBreadcrumb';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceViewNav from '../../resource/ResourceViewNav.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceFactList from '../../resource/ResourceFactList.vue';
import ResourceTable from '../../resource/ResourceTable.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';
import ResourceFile from '../../resource/ResourceFile.vue';
import { useResource } from '../../resource/useResource';
import { useResourceView } from '../../resource/useResourceView';
const { resource, resourceId, workspace } = useResource('库存实例');
const workbench = useWorkbenchStore();
const router = useRouter();
const { returnTo } = useResourceBreadcrumb({
    domain: 'inventory',
    kind: '库存实例',
    listLabel: '库存列表',
    resource,
    resourceId,
});
const material = computed(() => {
    const item = resource.value?.materialId ? workbench.resourceById.get(resource.value.materialId) : undefined;
    return item?.kind === '材料定义' ? item : undefined;
});
const tabs = [
    { id: 'overview', label: '概览' },
    { id: 'movement', label: '流转记录' },
    { id: 'file', label: '文件' },
];
const { view, select } = useResourceView(tabs.map((tab) => tab.id));
function openMaterial() {
    if (material.value) return router.push(`/main/material/detail/${encodeURIComponent(material.value.id)}`);
}
</script>
<template>
    <ResourceDetailPage label="库存实例详情">
        <template #header>
            <ResourceObjectHeader
                :id="resourceId"
                :title="resource?.name ?? '库存实例详情'"
                :icon="Package"
                :status="resource?.status"
                :back-to="returnTo"
                back-label="库存列表"
            >
                <Button variant="outline" disabled>
                    <LockKeyhole aria-hidden="true" />
                    预留
                </Button>
                <Button disabled>
                    <ArrowLeftRight aria-hidden="true" />
                    库存转移
                </Button>
            </ResourceObjectHeader>
            <ResourceViewNav v-if="resource" :items="tabs" :active="view" label="库存实例视图" @select="select" />
        </template>
        <ResourceEmpty v-if="!resource" text="当前工作区未找到该库存实例" />
        <template v-else>
            <template v-if="view === 'overview'">
                <ResourceSection title="实例信息">
                    <template #actions>
                        <Button v-if="material" variant="ghost" size="sm" @click="openMaterial">
                            {{ material.name }}
                            <ArrowUpRight aria-hidden="true" />
                        </Button>
                    </template>
                    <ResourceFactList
                        :fields="[
                            { label: '实例名称', value: resource.name },
                            { label: '所属材料', value: material?.name },
                            { label: 'Batch' },
                            { label: '数量 / 单位' },
                            { label: '可用数量' },
                            { label: '入库时间' },
                            { label: '有效期' },
                            { label: '工作区', value: workspace.current?.name },
                            { label: '说明', value: resource.description },
                        ]"
                    />
                </ResourceSection>
                <div class="grid min-w-0 gap-8 @3xl:grid-cols-2">
                    <ResourceSection title="当前位置">
                        <ResourceFactList :fields="[{ label: '设施' }, { label: '存储节点' }, { label: '孔位' }]" />
                        <div class="flex min-h-56 items-center justify-center rounded-md border bg-muted/20">
                            <ResourceEmpty text="位置布局未加载" />
                        </div>
                    </ResourceSection>
                    <ResourceSection title="最近流转"><ResourceEmpty text="实例流转记录未加载" /></ResourceSection>
                </div>
            </template>
            <ResourceSection v-else-if="view === 'movement'" title="流转记录">
                <ResourceTable
                    :fields="[
                        ['time', '时间', 180],
                        ['type', '类型', 120],
                        ['quantity', '数量变化', 120],
                        ['from', '来源位置', 200],
                        ['to', '目标位置', 200],
                        ['operator', '操作人', 120],
                    ]"
                />
            </ResourceSection>
            <ResourceFile v-else />
        </template>
    </ResourceDetailPage>
</template>
