<script setup lang="ts">
import { Settings2 } from '@lucide/vue';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import ResourceViewNav from '../resource/ResourceViewNav.vue';
import ResourceTable from '../resource/ResourceTable.vue';
import { useResourceView } from '../resource/useResourceView';
const tabs = [
    { id: 'all', label: '全部' },
    { id: 'critical', label: '严重短缺' },
    { id: 'low', label: '库存不足' },
    { id: 'expiring', label: '临期' },
];
const { view, select } = useResourceView(tabs.map((tab) => tab.id));
</script>
<template>
    <ResourcePage label="库存预警" layout="table">
        <template #actions>
            <Button variant="outline" disabled>
                <Settings2 aria-hidden="true" />
                预警规则
            </Button>
        </template>
        <ResourceViewNav :items="tabs" :active="view" label="库存预警分类" @select="select" />
        <ResourceTable
            empty-text="库存预警未加载"
            :fields="[
                ['material', '材料', 260],
                ['type', '预警类型', 130],
                ['available', '可用数量', 120],
                ['threshold', '安全阈值', 120],
                ['owner', '负责人', 120],
                ['status', '处理状态', 130],
            ]"
        />
    </ResourcePage>
</template>
