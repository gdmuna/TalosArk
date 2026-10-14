<script setup lang="ts">
import { computed, ref } from 'vue';
import { Folders, Plus, Building2 } from '@lucide/vue';
import { DataTable } from '@/component/data-table';
import { Button } from '@/ui/button';
import { useWorkspaceStore } from '@/module/workspace';
import { WorkspaceCreateDialog } from '@/module/workspace/ui';
import { DataSyncNotice } from '@/component/data-sync';
import ManagementPage from './component/ManagementPage.vue';
import { column } from './table';

const workspace = useWorkspaceStore();
const createOpen = ref(false);
const createMode = ref<'organization' | 'workspace'>('workspace');
const rows = computed(() =>
    workspace.workspaces.map((item) => ({
        id: item.id,
        name: item.name,
        organization: workspace.organizations.find((org) => org.id === item.organizationId)?.name ?? '—',
    }))
);
const columns = [column('name', '工作区名称', 220, Folders), column('organization', '所属组织', 180, Building2)];
</script>

<template>
    <ManagementPage title="工作区" layout="table">
        <template #actions>
            <Button
                v-if="workspace.canCreateOrganization"
                variant="outline"
                @click="
                    createMode = 'organization';
                    createOpen = true;
                "
            >
                <Plus aria-hidden="true" />
                新建组织
            </Button>
            <Button
                :disabled="!workspace.organizations.some((item) => item.canCreateWorkspace)"
                @click="
                    createMode = 'workspace';
                    createOpen = true;
                "
            >
                <Plus aria-hidden="true" />
                新建工作区
            </Button>
        </template>
        <DataSyncNotice
            scope="工作区"
            :error="workspace.syncError"
            :busy="workspace.busy"
            @retry="workspace.retrySync()"
        />
        <DataTable :data="rows" :columns="columns" search-label="搜索工作区" empty-text="暂无可用工作区" />
        <WorkspaceCreateDialog v-model:open="createOpen" :mode="createMode" />
    </ManagementPage>
</template>
