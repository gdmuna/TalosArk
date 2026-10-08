<script setup lang="ts">
import { computed } from 'vue';
import { Folders, Plus, Building2, UserRound, UsersRound, Package, CircleDot, Calendar } from '@lucide/vue';
import { DataTable } from '@/component/data-table';
import { Button } from '@/ui/button';
import { useWorkspaceStore } from '@/module/workspace';
import ManagementPage from './component/ManagementPage.vue';
import { column } from './table';

const workspace = useWorkspaceStore();
const rows = computed(() =>
    workspace.workspaces
        .filter((item) => item.organizationId === workspace.organization?.id)
        .map((item) => ({ id: item.id, name: item.name, organization: workspace.organization?.name ?? '—' }))
);
const columns = [
    column('name', '工作区名称', 220, Folders),
    column('organization', '所属组织', 180, Building2),
    column('owner', '负责人', 130, UserRound),
    column('members', '成员数', 110, UsersRound),
    column('resources', '资源数', 110, Package),
    column('state', '状态', 110, CircleDot),
    column('updatedAt', '最近更新', 180, Calendar),
];
</script>

<template>
    <ManagementPage title="工作区" layout="table">
        <template #actions>
            <Button disabled>
                <Plus aria-hidden="true" />
                新建工作区
            </Button>
        </template>
        <DataTable :data="rows" :columns="columns" search-label="搜索工作区" empty-text="工作区数据尚未加载" />
    </ManagementPage>
</template>
