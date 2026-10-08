<script setup lang="ts">
import { UserRound, Mail, ShieldCheck, Folders, CircleDot, UserPlus } from '@lucide/vue';
import { DataTable } from '@/component/data-table';
import { Button } from '@/ui/button';
import ManagementPage from './component/ManagementPage.vue';
import { column, type ManagementRow } from './table';

const rows: ManagementRow[] = [];
const columns = [
    column('name', '成员', 220, UserRound),
    column('email', '邮箱', 260, Mail),
    column('organizationRole', '组织角色', 170, ShieldCheck),
    column('workspaces', '所属工作区', 250, Folders),
    column('state', '状态', 130, CircleDot),
];
</script>

<template>
    <ManagementPage title="成员" layout="table">
        <template #actions>
            <Button disabled>
                <UserPlus aria-hidden="true" />
                邀请成员
            </Button>
        </template>
        <DataTable :data="rows" :columns="columns" search-label="搜索姓名或邮箱" empty-text="成员数据尚未加载" />
    </ManagementPage>
</template>
