<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Folders, Plus, Building2, Text, Eye, LogIn } from '@lucide/vue';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { Button } from '@/ui/button';
import { useWorkspaceStore } from '@/module/workspace';
import { WorkspaceCreateDialog } from '@/module/workspace/ui';
import { DataSyncNotice } from '@/component/data-sync';
import { SelectField } from '@/component/select-field';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import ManagementPage from './component/ManagementPage.vue';

const workspace = useWorkspaceStore();
const router = useRouter();
const organizationId = ref(workspace.organization?.id ?? 'all');
const query = ref('');
const filters = ref<Record<string, string[]>>({});
const previewId = ref<string | null>(null);
const scopeOptions = computed(() => [
    { value: 'all', label: '全部可访问组织' },
    ...workspace.organizations.map((item) => ({ value: item.id, label: item.name })),
]);
const createOpen = ref(false);
const createMode = ref<'organization' | 'workspace'>('workspace');
const rows = computed(() =>
    workspace.workspaces
        .filter((item) => organizationId.value === 'all' || item.organizationId === organizationId.value)
        .map((item) => ({
            id: item.id,
            organizationId: item.organizationId,
            name: item.name,
            description: item.description,
            organization: workspace.organizations.find((org) => org.id === item.organizationId)?.name ?? '—',
        }))
);
type Row = (typeof rows.value)[number];
const previewRow = computed(() => rows.value.find((item) => item.id === previewId.value));
const previewOpen = computed({
    get: () => !!previewRow.value,
    set: (value) => {
        if (!value) previewId.value = null;
    },
});
watch(organizationId, () => {
    query.value = '';
    filters.value = {};
    previewId.value = null;
});
watch(rows, (value) => {
    if (previewId.value && !value.some((item) => item.id === previewId.value)) previewId.value = null;
});
watch(
    () => workspace.organizations,
    () => {
        if (!scopeOptions.value.some((item) => item.value === organizationId.value)) organizationId.value = 'all';
    }
);
async function enter(row: Row) {
    if (workspace.busy || workspace.switching) return;
    const error = row.id === workspace.activeId ? '' : await workspace.select(row.id);
    if (!error && workspace.activeId === row.id) await router.push('/main/workbench/overview');
}
const actions = [
    { id: 'enter', label: '进入工作区', icon: LogIn, primary: true, run: enter },
    {
        id: 'detail',
        label: '详情',
        icon: Folders,
        run: (row: Row) =>
            router.push({ path: `/main/management/workspace/${row.id}`, query: { organization: row.organizationId } }),
    },
    {
        id: 'preview',
        label: '预览',
        icon: Eye,
        run: (row: Row) => {
            previewId.value = row.id;
        },
    },
];
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
    <ManagementPage
        title="工作区"
        layout="table"
        :context="scopeOptions.find((item) => item.value === organizationId)?.label"
    >
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
        <SelectField
            v-model="organizationId"
            label="工作区组织范围"
            :options="scopeOptions"
            :disabled="workspace.busy || workspace.switching"
        />
        <DataSyncNotice
            scope="工作区"
            :error="workspace.syncError"
            :busy="workspace.busy"
            @retry="workspace.retrySync()"
        />
        <p v-if="workspace.error" role="alert" class="text-sm text-destructive">{{ workspace.error }}</p>
        <DataTable
            v-model:query="query"
            v-model:filters="filters"
            :data="rows"
            :columns="columns"
            :actions="actions"
            :preview="(row) => (previewId = row.id)"
            :busy="workspace.busy || workspace.switching"
            search-label="搜索工作区或说明"
            :empty-text="
                query.trim() || Object.values(filters).some((value) => value.length)
                    ? '没有匹配的工作区'
                    : '当前范围暂无可用工作区'
            "
        >
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
        <WorkspaceCreateDialog
            v-model:open="createOpen"
            :mode="createMode"
            :organization-id="organizationId === 'all' ? undefined : organizationId"
        />
    </ManagementPage>
    <SheetInspector v-model:open="previewOpen" :title="previewRow?.name ?? '工作区预览'" description="工作区字段摘要">
        <ScrollSurface v-if="previewRow" class="min-h-0 flex-1 p-6 pt-10">
            <h2 class="mb-3 break-words pr-6 text-lg font-semibold">{{ previewRow.name }}</h2>
            <CopyableId :value="previewRow.id" label="工作区 ID" />
            <dl class="mt-6 grid grid-cols-[6rem_minmax(0,1fr)] gap-4 border-t pt-6 text-sm">
                <dt class="text-muted-foreground">所属组织</dt>
                <dd class="break-words">{{ previewRow.organization }}</dd>
                <dt class="text-muted-foreground">说明</dt>
                <dd class="break-words whitespace-pre-wrap">{{ previewRow.description || '—' }}</dd>
            </dl>
        </ScrollSurface>
        <footer v-if="previewRow" class="shrink-0 border-t p-4">
            <Button
                variant="outline"
                class="mb-2 w-full"
                @click="
                    router.push({
                        path: `/main/management/workspace/${previewRow.id}`,
                        query: { organization: previewRow.organizationId },
                    })
                "
            >
                查看详情
            </Button>
            <p v-if="workspace.error" role="alert" class="mb-3 break-words text-sm text-destructive">
                {{ workspace.error }}
            </p>
            <Button class="w-full" :disabled="workspace.busy || workspace.switching" @click="enter(previewRow)">
                <LogIn />
                进入工作区
            </Button>
        </footer>
    </SheetInspector>
</template>
