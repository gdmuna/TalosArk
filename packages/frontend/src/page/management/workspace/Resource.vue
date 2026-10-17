<script setup lang="ts">
import { ref, computed } from 'vue';
import { FlaskConical, Package, Monitor, Building2 } from '@lucide/vue';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { SelectField } from '@/component/select-field';
import { detailDate, type DetailResource } from '../detail/prototype';
const kind = ref('all'),
    relation = ref('all');
const props = defineProps<{ items: DetailResource[] }>();
const rows = computed(() =>
    props.items.filter(
        (item) =>
            (kind.value === 'all' || item.kind === kind.value) &&
            (relation.value === 'all' || item.relation === relation.value)
    )
);
const names = { material: '材料', stock: '库存', equipment: '设备', facility: '设施' };
const relations = { owned: '本工作区', managed: '管理设施', accessible: '设施访问' };
const icons = { material: FlaskConical, stock: Package, equipment: Monitor, facility: Building2 };
const columns: DataTableColumn<DetailResource>[] = [
    { id: 'name', label: '资源名称', size: 280, fill: true, value: (row) => row.name },
    { id: 'kind', label: '类型', size: 120, value: (row) => names[row.kind] },
    { id: 'relation', label: '关系', size: 140, value: (row) => relations[row.relation] },
    { id: 'resourceId', label: '资源身份 ID', size: 300, value: (row) => row.resourceId },
    { id: 'created', label: '创建时间', size: 200, value: (row) => detailDate(row.createdAt) },
];
</script>
<template>
    <div class="space-y-4">
        <div class="flex flex-wrap gap-3">
            <SelectField
                v-model="kind"
                label="资源类型"
                :options="[
                    { value: 'all', label: '全部类型' },
                    ...Object.entries(names).map(([value, label]) => ({ value, label })),
                ]"
            />
            <SelectField
                v-model="relation"
                label="资源关系"
                :options="[
                    { value: 'all', label: '全部关系' },
                    ...Object.entries(relations).map(([value, label]) => ({ value, label })),
                ]"
            />
        </div>
        <DataTable
            :key="`${kind}:${relation}`"
            :data="rows"
            :columns="columns"
            search-label="搜索模拟资源"
            empty-text="当前范围没有匹配的资源"
        >
            <template #cell-name="{ row, preview }">
                <button
                    class="group flex w-full items-start gap-3 text-left after:absolute after:inset-0"
                    :aria-label="`预览${row.name}`"
                    @click="preview()"
                >
                    <component :is="icons[row.kind]" class="mt-0.5 size-5 shrink-0 text-primary" />
                    <span class="min-w-0">
                        <span class="block font-medium group-hover:underline group-focus-visible:underline">
                            {{ row.name }}
                        </span>
                        <span class="mt-1 block truncate font-mono text-xs text-muted-foreground">{{ row.id }}</span>
                    </span>
                </button>
            </template>
        </DataTable>
    </div>
</template>
