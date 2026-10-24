<script setup lang="ts">
import { Check, Download } from '@lucide/vue';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import ResourceTable from '../resource/ResourceTable.vue';
import ResourceViewNav from '../resource/ResourceViewNav.vue';
import { useResourceView } from '../resource/useResourceView';
const tabs = [
    { id: 'active', label: '待处理' },
    { id: 'acknowledged', label: '已确认' },
    { id: 'all', label: '全部告警' },
];
const { view, select } = useResourceView(tabs.map((tab) => tab.id));
</script>
<template>
    <ResourcePage label="设备告警" layout="table">
        <template #actions>
            <Button variant="outline" disabled>
                <Download aria-hidden="true" />
                导出告警
            </Button>
            <Button disabled>
                <Check aria-hidden="true" />
                确认告警
            </Button>
        </template>
        <ResourceViewNav :items="tabs" :active="view" label="设备告警状态" @select="select" />
        <ResourceTable
            empty-text="设备告警事件未加载"
            :fields="[
                ['severity', '等级', 100],
                ['equipment', '设备', 240],
                ['event', '告警事件', 260],
                ['firstSeen', '首次发生', 180],
                ['status', '处理状态', 130],
            ]"
        />
    </ResourcePage>
</template>
