<script setup lang="ts">
import { Calendar, UserRound, Activity, Package, Folders, CircleDot, Download } from '@lucide/vue';
import { DataTable } from '@/component/data-table';
import { Button } from '@/ui/button';
import ManagementPage from './component/ManagementPage.vue';
import { column, type ManagementRow } from './table';

const rows: ManagementRow[] = [];
const columns = [
    column('occurredAt', '时间', 200, Calendar),
    column('actor', '操作者', 180, UserRound),
    column('action', '操作', 220, Activity),
    column('resource', '资源', 260, Package),
    column('workspace', '工作区', 180, Folders),
    column('result', '结果', 120, CircleDot),
];
</script>

<template>
    <ManagementPage title="审计日志" layout="table">
        <template #actions>
            <Button variant="outline" disabled>
                <Download aria-hidden="true" />
                导出日志
            </Button>
        </template>
        <DataTable
            :data="rows"
            :columns="columns"
            search-label="搜索操作者、操作或资源"
            empty-text="审计记录尚未加载"
        />
    </ManagementPage>
</template>
