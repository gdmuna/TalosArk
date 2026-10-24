<script setup lang="ts">
import { Monitor, Shapes, Network, Hash, CircleDot, Activity, Plus } from '@lucide/vue';
import { DataTable } from '@/component/data-table';
import { Button } from '@/ui/button';
import ManagementPage from './component/ManagementPage.vue';
import { column, type ManagementRow } from './table';

const rows: ManagementRow[] = [];
const columns = [
    column('name', '设备名称', 240, Monitor),
    column('type', '设备类型', 180, Shapes),
    column('backend', '控制后端', 220, Network),
    column('externalId', '外部设备标识', 220, Hash),
    column('state', '接入状态', 130, CircleDot),
    column('health', '连接健康', 130, Activity),
];
</script>

<template>
    <ManagementPage title="设备接入" layout="table">
        <template #actions>
            <Button disabled>
                <Plus aria-hidden="true" />
                接入设备
            </Button>
        </template>
        <DataTable
            :data="rows"
            :columns="columns"
            search-label="搜索设备、控制后端或外部标识"
            empty-text="接入设备数据尚未加载"
        />
    </ManagementPage>
</template>
