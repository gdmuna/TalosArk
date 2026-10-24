<script setup lang="ts">
import { Plus } from '@lucide/vue';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import ResourceTable from '../resource/ResourceTable.vue';
import ResourceViewNav from '../resource/ResourceViewNav.vue';
import { useResourceView } from '../resource/useResourceView';
const tabs = [
    { id: 'all', label: '全部任务' },
    { id: 'active', label: '进行中' },
    { id: 'completed', label: '已完成' },
];
const { view, select } = useResourceView(tabs.map((tab) => tab.id));
</script>
<template>
    <ResourcePage label="盘点" layout="table">
        <template #actions>
            <Button disabled>
                <Plus aria-hidden="true" />
                新建盘点
            </Button>
        </template>
        <ResourceViewNav :items="tabs" :active="view" label="盘点任务状态" @select="select" />
        <ResourceTable
            empty-text="盘点任务未加载"
            :fields="[
                ['name', '盘点任务', 240],
                ['scope', '盘点范围', 180],
                ['status', '任务状态', 120],
                ['progress', '进度', 100],
                ['owner', '负责人', 120],
                ['start', '开始时间', 180],
                ['due', '截止时间', 180],
            ]"
        />
    </ResourcePage>
</template>
