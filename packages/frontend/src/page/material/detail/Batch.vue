<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Archive, ArchiveRestore, Package, Pencil } from '@lucide/vue';
import { MaterialBatchEditor, useMaterialRead, useMaterialStore } from '@/module/material';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { Button } from '@/ui/button';
import { CopyableId } from '@/component/inspector';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceFactList from '../../resource/ResourceFactList.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';

const route = useRoute();
const router = useRouter();
const store = useMaterialStore();
const materialId = computed(() => String(route.params.resourceId ?? ''));
const batchId = computed(() => String(route.params.batchId ?? ''));
const materialPath = computed(() => `/main/material/detail/${encodeURIComponent(materialId.value)}`);
const material = useMaterialRead(
    (context, signal) => context.source.get(context.scope, materialId.value, signal),
    [materialId]
);
const { data, loading, error, reload } = useMaterialRead(
    (context, signal) => context.source.getBatch(context.scope, materialId.value, batchId.value, signal),
    [materialId, batchId]
);
const permissions = useMaterialRead(
    (context, signal) =>
        context.source.listBatches(
            context.scope,
            materialId.value,
            { q: '', state: 'all', page: 1, pageSize: 1 },
            signal
        ),
    [materialId]
);
const editorOpen = ref(false);
const syncPending = ref(false);
let generation = 0;
onScopeDispose(() => {
    generation++;
});
const disabled = computed(
    () =>
        !data.value ||
        !!error.value ||
        !!permissions.error.value ||
        !permissions.data.value?.canManage ||
        store.busy ||
        loading.value ||
        syncPending.value
);
watch(
    [() => store.scope, materialId, batchId],
    () => {
        generation++;
        editorOpen.value = false;
        syncPending.value = false;
    },
    { flush: 'sync' }
);
provideBreadcrumbs(() => [
    { id: 'material-list', label: '材料列表', to: '/main/material/list' },
    {
        id: 'material',
        label: material.data.value?.material.name ?? '材料详情',
        to: { path: materialPath.value, query: { view: 'batch' } },
    },
    { id: 'batch', label: data.value?.batchNumber ?? '批次详情' },
]);
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
async function archive() {
    const batch = data.value;
    if (!batch || disabled.value) return;
    const current = generation;
    const saved = await store.mutate(({ source, scope, signal }) =>
        source.archiveBatch(
            scope,
            materialId.value,
            batch.id,
            {
                expectedRevision: batch.revision,
                archived: !batch.archivedAt,
            },
            signal
        )
    );
    if (saved && current === generation) await afterCommit();
}
</script>

<template>
    <ResourceDetailPage label="批次详情">
        <template #header>
            <ResourceObjectHeader
                :id="batchId"
                :title="data?.batchNumber ?? '批次详情'"
                :icon="Package"
                :status="data ? (data.archivedAt ? '已归档' : '有效') : undefined"
                :back-to="`${materialPath}?view=batch`"
                back-label="来源批次"
            >
                <Button variant="outline" :disabled="disabled || !!data?.archivedAt" @click="editorOpen = true">
                    <Pencil aria-hidden="true" />
                    编辑批次
                </Button>
                <Button variant="outline" :disabled="disabled" @click="archive">
                    <component :is="data?.archivedAt ? ArchiveRestore : Archive" aria-hidden="true" />
                    {{ data?.archivedAt ? '恢复批次' : '归档批次' }}
                </Button>
            </ResourceObjectHeader>
        </template>
        <div
            v-if="error || material.error.value || permissions.error.value || syncPending || store.error"
            role="alert"
            class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
        >
            <p class="text-sm text-destructive">
                {{
                    syncPending
                        ? '操作已成功，但批次尚未同步。请仅重新加载。'
                        : error || material.error.value || permissions.error.value || store.error
                }}
            </p>
            <Button
                variant="outline"
                :disabled="loading"
                @click="
                    synchronize();
                    material.reload();
                    permissions.reload();
                "
            >
                重新加载
            </Button>
        </div>
        <ResourceEmpty v-if="loading && !data" text="正在加载批次" />
        <ResourceEmpty v-else-if="!data" text="当前工作区没有可访问的批次" />
        <template v-else>
            <ResourceSection title="批次信息">
                <div class="space-y-4">
                    <CopyableId :value="data.id" label="批次 ID" />
                    <ResourceFactList
                        :fields="[
                            { label: '所属材料', value: material.data.value?.material.name ?? '正在加载' },
                            { label: '批号', value: data.batchNumber },
                            { label: '生产日期', value: data.manufacturedOn ?? '未填写' },
                            {
                                label: '有效期',
                                value:
                                    data.expiry.kind === 'DATED'
                                        ? data.expiry.date
                                        : data.expiry.kind === 'NONE'
                                          ? '无期限'
                                          : '未知',
                            },
                            { label: '状态', value: data.archivedAt ? '已归档' : '有效' },
                            { label: '备注', value: data.notes || '无' },
                        ]"
                    />
                </div>
            </ResourceSection>
            <ResourceSection title="批次实例">
                <Button
                    variant="outline"
                    @click="router.push({ path: '/main/inventory/ledger', query: { materialId, batchId } })"
                >
                    查看此批次库存
                </Button>
            </ResourceSection>
        </template>
        <MaterialBatchEditor
            v-model:open="editorOpen"
            :material-id="materialId"
            :batch="data"
            :on-committed="afterCommit"
        />
    </ResourceDetailPage>
</template>
