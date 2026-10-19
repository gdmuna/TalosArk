<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Package } from '@lucide/vue';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import { useResourceBreadcrumb } from '../../resource/useResourceBreadcrumb';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceFactList from '../../resource/ResourceFactList.vue';
import ResourceTable from '../../resource/ResourceTable.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';
import { useResource } from '../../resource/useResource';
const { resource, resourceId } = useResource('材料定义');
const route = useRoute();
const bankId = computed(() => String(route.params.bankId));
const batchId = computed(() => String(route.params.batchId));
useResourceBreadcrumb({
    domain: 'material',
    kind: '材料定义',
    listLabel: '材料列表',
    resource,
    resourceId,
    parents: () => [
        {
            id: 'bank',
            label: 'Cell Bank',
            to: `/main/material/detail/${encodeURIComponent(resourceId.value)}/bank/${encodeURIComponent(bankId.value)}?view=batch`,
        },
        { id: 'batch', label: 'Batch' },
    ],
});
</script>
<template>
    <ResourceDetailPage label="Batch 详情">
        <template #header>
            <ResourceObjectHeader
                :id="batchId"
                title="Batch"
                :icon="Package"
                :back-to="`/main/material/detail/${encodeURIComponent(resourceId)}/bank/${encodeURIComponent(bankId)}?view=batch`"
                back-label="Cell Bank"
            />
        </template>
        <ResourceEmpty v-if="!resource" text="当前工作区未找到所属材料" />
        <template v-else>
            <ResourceSection title="批次信息">
                <ResourceFactList
                    :fields="[
                        { label: '所属材料', value: resource.name },
                        { label: 'Cell Bank', value: bankId },
                        { label: '父级批次' },
                        { label: '质量状态' },
                        { label: '制备日期' },
                        { label: '可用实例' },
                        { label: '存储位置' },
                        { label: '负责人' },
                    ]"
                />
            </ResourceSection>
            <ResourceSection title="批次实例">
                <ResourceTable
                    :fields="[
                        ['id', '实例 ID', 200],
                        ['location', '位置', 240],
                        ['status', '状态', 130],
                        ['quantity', '数量', 120],
                    ]"
                />
            </ResourceSection>
            <ResourceSection title="批次检验">
                <ResourceTable
                    :fields="[
                        ['project', '项目', 260],
                        ['result', '结果', 120],
                        ['date', '日期', 180],
                        ['owner', '检验人', 120],
                    ]"
                />
            </ResourceSection>
        </template>
    </ResourceDetailPage>
</template>
