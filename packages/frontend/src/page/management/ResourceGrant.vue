<script setup lang="ts">
import { Package, Shapes, UserRound, KeyRound, GitBranch, Calendar, CircleDot, Plus } from '@lucide/vue';
import { DataTable } from '@/component/data-table';
import { Button } from '@/ui/button';
import ManagementPage from './component/ManagementPage.vue';
import { column, type ManagementRow } from './table';

const rows: ManagementRow[] = [];
const columns = [
    column('resource', '资源', 240, Package),
    column('type', '资源类型', 130, Shapes),
    column('principal', '授权对象', 200, UserRound),
    column('permission', '权限', 160, KeyRound),
    column('source', '授权来源', 170, GitBranch),
    column('expiresAt', '有效期', 180, Calendar),
    column('state', '状态', 110, CircleDot),
];
</script>

<template>
    <ManagementPage title="资源授权" layout="table">
        <template #actions>
            <Button disabled>
                <Plus aria-hidden="true" />
                新建授权
            </Button>
        </template>
        <DataTable :data="rows" :columns="columns" search-label="搜索资源或授权对象" empty-text="授权记录尚未加载" />
    </ManagementPage>
</template>
