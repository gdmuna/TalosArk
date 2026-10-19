<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Archive, ArchiveRestore, Eye, Layers, Pencil, Plus } from '@lucide/vue';
import type { PaginationState } from '@tanstack/vue-table';
import type { MaterialBatch, MaterialBatchQuery } from '../data/source';
import { useMaterialStore } from '../model/store';
import { useMaterialRead } from '../model/useMaterialRead';
import MaterialBatchEditor from './MaterialBatchEditor.vue';
import { DataTable, type DataTableAction, type DataTableColumn } from '@/component/data-table';
import { CopyableId, SheetInspector } from '@/component/inspector';
import { SelectField } from '@/component/select-field';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';

const props = defineProps<{ materialId: string; archived?: boolean }>();
const router = useRouter();
const store = useMaterialStore();
const query = ref('');
const state = ref<MaterialBatchQuery['state']>('active');
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const request = computed<MaterialBatchQuery>(() => ({
    q: query.value.trim(),
    state: state.value,
    page: pagination.value.pageIndex + 1,
    pageSize: pagination.value.pageSize,
}));
const { data, loading, error, reload } = useMaterialRead(
    (context, signal) => context.source.listBatches(context.scope, props.materialId, request.value, signal),
    [() => props.materialId, request]
);
const total = ref(0);
watch([data, error], ([value, failure]) => {
    if (value) total.value = value.total;
    else if (failure) total.value = 0;
});
const editorOpen = ref(false);
const editing = ref<MaterialBatch>();
const selectedId = ref('');
const syncPending = ref(false);
let generation = 0;
onScopeDispose(() => {
    generation++;
});
const preview = useMaterialRead(
    (context, signal) =>
        selectedId.value
            ? context.source.getBatch(context.scope, props.materialId, selectedId.value, signal)
            : Promise.resolve(undefined),
    [selectedId, () => props.materialId]
);
const selected = computed(() => preview.data.value);
const open = computed({
    get: () => !!selectedId.value,
    set: (value) => {
        if (!value) selectedId.value = '';
    },
});
const disabled = computed(
    () => store.busy || loading.value || !!error.value || syncPending.value || !data.value?.canManage
);
const columns: DataTableColumn<MaterialBatch>[] = [
    {
        id: 'batchNumber',
        label: '批号',
        icon: Layers,
        size: 240,
        fill: true,
        sortable: false,
        value: (row) => row.batchNumber,
    },
    {
        id: 'manufacturedOn',
        label: '生产日期',
        size: 150,
        sortable: false,
        value: (row) => row.manufacturedOn ?? '未填写',
    },
    { id: 'expiry', label: '有效期', size: 150, sortable: false, value: (row) => expiryLabel(row) },
    { id: 'state', label: '状态', size: 100, sortable: false, value: (row) => (row.archivedAt ? '已归档' : '有效') },
    { id: 'notes', label: '备注', size: 220, sortable: false, value: (row) => row.notes || '—' },
];
const actions = computed<DataTableAction<MaterialBatch>[]>(() => [
    {
        id: 'detail',
        label: '详情',
        icon: Eye,
        primary: true,
        run: (row) =>
            void router.push(
                `/main/material/detail/${encodeURIComponent(props.materialId)}/batch/${encodeURIComponent(row.id)}`
            ),
    },
    {
        id: 'preview',
        label: '预览',
        icon: Eye,
        run: (row) => {
            selectedId.value = row.id;
        },
    },
    {
        id: 'edit',
        label: '编辑',
        icon: Pencil,
        disabled: (row) => disabled.value || !!row.archivedAt,
        run: (row) => edit(row),
    },
    {
        id: 'archive',
        label: '归档',
        icon: Archive,
        disabled: (row) => disabled.value || !!row.archivedAt,
        run: (row) => archive(row, true),
    },
    {
        id: 'restore',
        label: '恢复',
        icon: ArchiveRestore,
        disabled: (row) => disabled.value || !row.archivedAt,
        run: (row) => archive(row, false),
    },
]);
watch(
    [query, state, () => props.materialId],
    () => {
        total.value = 0;
        pagination.value = { ...pagination.value, pageIndex: 0 };
    },
    { flush: 'sync' }
);
watch(
    [() => store.scope, () => props.materialId],
    () => {
        generation++;
        total.value = 0;
        pagination.value.pageIndex = 0;
        selectedId.value = '';
        editorOpen.value = false;
        syncPending.value = false;
    },
    { flush: 'sync' }
);
function expiryLabel(batch: MaterialBatch) {
    return batch.expiry.kind === 'DATED' ? batch.expiry.date : batch.expiry.kind === 'NONE' ? '无期限' : '未知';
}
function edit(batch?: MaterialBatch) {
    if (disabled.value || (!batch && props.archived)) return;
    store.error = '';
    editing.value = batch;
    editorOpen.value = true;
}
async function synchronize() {
    const current = generation;
    store.error = '';
    const synchronized = await reload();
    if (current === generation && synchronized) syncPending.value = false;
    return synchronized;
}
async function afterCommit() {
    syncPending.value = true;
    return synchronize();
}
async function archive(batch: MaterialBatch, archived: boolean) {
    if (disabled.value) return;
    const current = generation;
    const saved = await store.mutate(({ source, scope, signal }) =>
        source.archiveBatch(
            scope,
            props.materialId,
            batch.id,
            {
                expectedRevision: batch.revision,
                archived,
            },
            signal
        )
    );
    if (saved && current === generation) await afterCommit();
}
</script>

<template>
    <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <SelectField
                v-model="state"
                label="批次状态"
                :options="[
                    { value: 'active', label: '有效批次' },
                    { value: 'archived', label: '已归档批次' },
                    { value: 'all', label: '全部批次' },
                ]"
            />
            <Button :disabled="disabled || archived" @click="edit()">
                <Plus aria-hidden="true" />
                新建批次
            </Button>
        </div>
        <div
            v-if="syncPending || error || store.error"
            role="alert"
            class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
        >
            <p class="text-destructive">
                {{ syncPending ? '操作已成功，但批次尚未同步。请仅重新加载，不要重复提交。' : error || store.error }}
            </p>
            <Button variant="outline" size="sm" :disabled="loading" @click="synchronize">重新加载</Button>
        </div>
        <DataTable
            v-model:query="query"
            v-model:pagination="pagination"
            :data="data?.items ?? []"
            :columns="columns"
            :actions="actions"
            :server-total="total"
            :filtering="false"
            :busy="loading"
            search-label="搜索批号"
            :preview="(row) => (selectedId = row.id)"
            :empty-text="error ? '批次加载失败' : loading ? '正在加载批次' : '暂无批次'"
        >
            <template #cell-state="{ row }">
                <StateBadge :tone="row.archivedAt ? 'neutral' : 'success'">
                    {{ row.archivedAt ? '已归档' : '有效' }}
                </StateBadge>
            </template>
        </DataTable>
        <SheetInspector v-model:open="open" title="批次预览" description="材料来源批次资料">
            <div class="space-y-4 p-6">
                <p v-if="preview.loading.value" class="text-sm text-muted-foreground">正在加载批次</p>
                <template v-else-if="preview.error.value">
                    <p role="alert" class="text-sm text-destructive">{{ preview.error.value }}</p>
                    <Button variant="outline" @click="preview.reload">重新加载</Button>
                </template>
                <template v-else-if="selected">
                    <h2 class="text-lg font-semibold">{{ selected.batchNumber }}</h2>
                    <CopyableId :value="selected.id" label="批次 ID" />
                    <dl class="space-y-3 text-sm">
                        <div>
                            <dt class="text-muted-foreground">生产日期</dt>
                            <dd>{{ selected.manufacturedOn ?? '未填写' }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">有效期</dt>
                            <dd>{{ expiryLabel(selected) }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">备注</dt>
                            <dd class="whitespace-pre-wrap break-words">{{ selected.notes || '无' }}</dd>
                        </div>
                    </dl>
                </template>
            </div>
        </SheetInspector>
        <MaterialBatchEditor
            v-model:open="editorOpen"
            :material-id="materialId"
            :batch="editing"
            :on-committed="afterCommit"
        />
    </div>
</template>
