<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Layers, Plus } from '@lucide/vue';
import { Button } from '@/ui/button';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
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
const { resource, resourceId } = useResource('材料定义');
const route = useRoute();
const bankId = computed(() => String(route.params.bankId));
const tabs = [
    { id: 'overview', label: '概览' },
    { id: 'batch', label: 'Batch' },
    { id: 'quality', label: '检验' },
    { id: 'file', label: '文件' },
];
const { view, select } = useResourceView(tabs.map((tab) => tab.id));
useResourceBreadcrumb({
    domain: 'material',
    kind: '材料定义',
    listLabel: '材料列表',
    resource,
    resourceId,
    parents: () => [{ id: 'bank', label: 'Cell Bank' }],
});
</script>
<template>
    <ResourceDetailPage label="Cell Bank">
        <template #header>
            <ResourceObjectHeader
                :id="bankId"
                title="Cell Bank"
                :icon="Layers"
                :back-to="`/main/material/detail/${encodeURIComponent(resourceId)}`"
                back-label="材料详情"
            >
                <Button disabled>
                    <Plus aria-hidden="true" />
                    新建 Batch
                </Button>
            </ResourceObjectHeader>
            <ResourceViewNav v-if="resource" :items="tabs" :active="view" label="Cell Bank 视图" @select="select" />
        </template>
        <ResourceEmpty v-if="!resource" text="当前工作区未找到所属材料" />
        <template v-else>
            <template v-if="view === 'overview'">
                <ResourceSection title="Cell Bank 信息">
                    <ResourceFactList
                        :fields="[
                            { label: '所属材料', value: resource.name },
                            { label: 'Bank 类型' },
                            { label: '父级 Bank' },
                            { label: '来源' },
                            { label: '质量状态' },
                            { label: '建立时间' },
                        ]"
                    />
                </ResourceSection>
                <ResourceSection title="Batch">
                    <ResourceTable
                        :fields="[
                            ['id', 'Batch ID', 200],
                            ['parent', '父级批次', 180],
                            ['quality', '质量状态', 130],
                            ['available', '可用数量', 120],
                            ['location', '存储位置', 200],
                        ]"
                    />
                </ResourceSection>
            </template>
            <template v-else-if="view === 'batch'">
                <ResourceSection title="Batch">
                    <ResourceTable
                        :fields="[
                            ['id', 'Batch ID', 200],
                            ['parent', '父级批次', 180],
                            ['quality', '质量状态', 130],
                            ['available', '可用数量', 120],
                            ['location', '存储位置', 200],
                        ]"
                    />
                </ResourceSection>
                <ResourceSection title="批次详情"><ResourceEmpty text="选择 Batch" /></ResourceSection>
            </template>
            <ResourceSection v-else-if="view === 'quality'" title="Bank 检验记录">
                <ResourceTable
                    :fields="[
                        ['id', '检验 ID', 180],
                        ['project', '检验项目', 220],
                        ['result', '结果', 120],
                        ['date', '日期', 180],
                    ]"
                />
            </ResourceSection>
            <ResourceFile v-else />
        </template>
    </ResourceDetailPage>
</template>
