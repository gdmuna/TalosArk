<script setup lang="ts">
import { DoorOpen, Hash, Building2, MapPin, Folders, Warehouse, CircleDot, Plus } from '@lucide/vue';
import { DataTable } from '@/component/data-table';
import { Button } from '@/ui/button';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementField from './component/ManagementField.vue';
import ManagementEmpty from './component/ManagementEmpty.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import { column, type ManagementRow } from './table';
import { useManagementView } from './useManagementView';

const views = [
    { value: 'list', label: '设施列表' },
    { value: 'topology', label: '设施拓扑' },
];
const view = useManagementView(views);

const rows: ManagementRow[] = [];
const columns = [
    column('name', '设施名称', 220, DoorOpen),
    column('code', '设施编号', 150, Hash),
    column('organization', '所属组织', 170, Building2),
    column('location', '位置', 200, MapPin),
    column('workspace', '管理工作区', 200, Folders),
    column('nodes', '存储节点数', 120, Warehouse),
    column('state', '状态', 110, CircleDot),
];
</script>

<template>
    <ManagementPage title="设施" :layout="view === 'list' ? 'table' : 'tool'">
        <template #actions>
            <Button disabled>
                <Plus aria-hidden="true" />
                新建设施
            </Button>
        </template>
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="设施视图" /></template>
        <DataTable
            v-if="view === 'list'"
            :data="rows"
            :columns="columns"
            search-label="搜索设施名称、编号或位置"
            empty-text="设施数据尚未加载"
        />
        <ManagementSection v-else title="设施拓扑">
            <ManagementField label="设施" placeholder="未选择设施" />
            <ManagementEmpty text="设施拓扑尚未加载" />
        </ManagementSection>
    </ManagementPage>
</template>
