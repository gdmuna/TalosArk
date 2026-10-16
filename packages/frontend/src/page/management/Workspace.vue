<script setup lang="ts">
import { computed, ref } from 'vue';
import { Folders, Plus, Building2, Text } from '@lucide/vue';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { Button } from '@/ui/button';
import { useWorkspaceStore } from '@/module/workspace';
import { WorkspaceCreateDialog } from '@/module/workspace/ui';
import { DataSyncNotice } from '@/component/data-sync';
import ManagementPage from './component/ManagementPage.vue';

const workspace = useWorkspaceStore();
const createOpen = ref(false);
const createMode = ref<'organization' | 'workspace'>('workspace');
const rows = computed(() =>
    workspace.workspaces.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        organization: workspace.organizations.find((org) => org.id === item.organizationId)?.name ?? '—',
    }))
);
const columns: DataTableColumn<(typeof rows.value)[number]>[] = [
    { id: 'name', label: '工作区名称', size: 300, icon: Folders, value: (row) => row.name },
    { id: 'organization', label: '所属组织', size: 220, icon: Building2, value: (row) => row.organization },
    {
        id: 'description',
        label: '说明',
        size: 280,
        maxSize: 1200,
        fill: true,
        icon: Text,
        value: (row) => row.description || '—',
    },
];
</script>

<template>
    <ManagementPage title="工作区" layout="table" context="我可访问的工作区">
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
        <DataTable :data="rows" :columns="columns" search-label="搜索工作区或说明" empty-text="暂无可用工作区">
            <template #cell-name="{ row, preview }">
                <button
                    class="group flex w-full items-start gap-3 text-left after:absolute after:inset-0"
                    :aria-label="`预览${row.name}`"
                    @click="preview"
                >
                    <Folders class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span class="min-w-0">
                        <span class="block break-words font-medium group-hover:underline group-focus-visible:underline">
                            {{ row.name }}
                        </span>
                        <span class="mt-1 block break-all font-mono text-xs text-muted-foreground">{{ row.id }}</span>
                    </span>
                </button>
            </template>
        </DataTable>
        <WorkspaceCreateDialog v-model:open="createOpen" :mode="createMode" />
    </ManagementPage>
</template>
