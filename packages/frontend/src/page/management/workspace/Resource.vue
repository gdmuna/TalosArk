<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { refDebounced } from '@vueuse/core';
import type { Material, MaterialScope } from '@talos-ark/contracts/material';
import type { PaginationState } from '@tanstack/vue-table';
import { Eye, FlaskConical } from '@lucide/vue';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { useMaterialDataSource, branchPresentation } from '@/module/material';
import { useWorkspaceStore, teamErrorMessage } from '@/module/workspace';
import { Button } from '@/ui/button';
import { useDetailRead, detailDate } from '../detail/read';

const props = defineProps<{ scope: MaterialScope }>();
const source = useMaterialDataSource(),
    workspace = useWorkspaceStore(),
    router = useRouter();
const query = ref(''),
    search = refDebounced(query, 200);
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
watch(search, () => {
    pagination.value = { ...pagination.value, pageIndex: 0 };
});
const key = computed(
    () => `${props.scope.organizationId}:${props.scope.workspaceId}:${search.value}:${JSON.stringify(pagination.value)}`
);
const result = useDetailRead(key, (signal) =>
    source.list(
        props.scope,
        {
            q: search.value,
            page: pagination.value.pageIndex + 1,
            pageSize: pagination.value.pageSize,
            state: 'all',
            sort: 'updatedAt:desc',
        },
        signal
    )
);
const total = ref(0);
watch(result.data, (value) => {
    if (value) total.value = value.total;
});
const navigationError = ref('');
async function openMaterial(row: Material) {
    navigationError.value = '';
    const selectedScope = { ...props.scope };
    try {
        const error =
            workspace.activeId === selectedScope.workspaceId ? '' : await workspace.select(selectedScope.workspaceId);
        if (error) {
            navigationError.value = error;
            return;
        }
        if (workspace.activeId !== selectedScope.workspaceId) return;
        await router.push(`/main/material/detail/${encodeURIComponent(row.id)}`);
    } catch (cause) {
        navigationError.value = teamErrorMessage(cause);
    }
}
const columns: DataTableColumn<Material>[] = [
    { id: 'name', label: '材料', icon: FlaskConical, size: 280, fill: true, sortable: false, value: (row) => row.name },
    { id: 'code', label: '编号', size: 160, sortable: false, value: (row) => row.code ?? '未填写' },
    {
        id: 'branch',
        label: '业务分支',
        size: 140,
        sortable: false,
        value: (row) => branchPresentation(row.branch).label,
    },
    { id: 'type', label: '材料分类', size: 140, sortable: false, value: (row) => row.type.name },
    { id: 'state', label: '状态', size: 100, sortable: false, value: (row) => (row.archivedAt ? '已归档' : '有效') },
    { id: 'created', label: '创建时间', size: 200, sortable: false, value: (row) => detailDate(row.createdAt) },
];
</script>
<template>
    <div class="space-y-4">
        <div class="flex flex-wrap gap-5 border-b pb-3 text-sm">
            <span class="font-medium">材料</span>
            <span class="text-muted-foreground">库存 · 未接入</span>
            <span class="text-muted-foreground">设备 · 未接入</span>
            <span class="text-muted-foreground">设施 · 未接入</span>
        </div>
        <div v-if="result.error.value" role="alert" class="flex items-center gap-3 text-sm text-destructive">
            {{ result.error.value }}
            <Button variant="outline" size="sm" @click="result.refresh">重新加载</Button>
        </div>
        <p v-if="navigationError" role="alert" class="text-sm text-destructive">{{ navigationError }}</p>
        <DataTable
            v-model:query="query"
            v-model:pagination="pagination"
            :data="result.data.value?.items ?? []"
            :columns="columns"
            :server-total="total"
            :filtering="false"
            :busy="result.loading.value || workspace.switching"
            :actions="[{ id: 'detail', label: '详情', icon: Eye, primary: true, run: openMaterial }]"
            search-label="搜索材料"
            :empty-text="result.error.value || (result.loading.value ? '正在加载材料' : '当前范围没有匹配的材料')"
        />
    </div>
</template>
