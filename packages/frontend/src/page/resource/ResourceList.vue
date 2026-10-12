<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import { useRouter } from 'vue-router';
import { useQueryCommand } from '@/platform/navigation';
import { Eye, Plus, Tag } from '@lucide/vue';
import { useWorkbenchStore, useResourcePreview, stateTone, type Resource } from '@/module/workbench';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import ResourcePage from './ResourcePage.vue';
import ResourcePreview from './ResourcePreview.vue';
import { useResourceQuery } from './useResourceQuery';

const props = defineProps<{
    title: string;
    kind: Resource['kind'];
    domain: string;
    icon: Component;
    fields: [string, string, number][];
    createLabel: string;
}>();
const workbench = useWorkbenchStore();
const router = useRouter();
const rows = computed(() => workbench.currentResources.filter((item) => item.kind === props.kind));
const { resource: selected, selectedId } = useResourcePreview(ref<Resource | null>(null), rows);
const query = useResourceQuery();
const columns = computed<DataTableColumn<Resource>[]>(() => [
    { id: 'name', label: props.title, size: 300, icon: props.icon, value: (row) => row.name },
    { id: 'id', label: 'ID', size: 180, icon: Tag, value: (row) => row.id },
    ...props.fields.map(([id, label, size]) => ({ id, label, size, value: () => '—' })),
    { id: 'status', label: '状态', size: 120, value: (row) => row.status },
]);
useQueryCommand('resource', (id) => {
    selectedId.value = id;
});
function fullDetail(item: Resource) {
    router.push(`/main/${props.domain}/detail/${encodeURIComponent(item.id)}`);
    selectedId.value = null;
}
</script>
<template>
    <ResourcePage :label="title" layout="table">
        <template #actions>
            <Button disabled>
                <Plus aria-hidden="true" />
                {{ createLabel }}
            </Button>
        </template>
        <ResourcePreview
            v-model="selected"
            :detail-to="selected ? `/main/${domain}/detail/${encodeURIComponent(selected.id)}` : undefined"
        >
            <template #main>
                <DataTable
                    v-model:query="query"
                    :data="rows"
                    :columns="columns"
                    :active-id="selectedId"
                    :preview="
                        (row) => {
                            selectedId = row.id;
                        }
                    "
                    :search-label="`搜索${title}或 ID`"
                    :search-text="(row) => `${row.name} ${row.id} ${row.description}`"
                    :empty-text="workbench.busy ? '正在加载' : '暂无可用的资源摘要'"
                    :actions="[
                        {
                            id: 'detail',
                            label: '详情',
                            icon: Eye,
                            primary: true,
                            run: fullDetail,
                        },
                        {
                            id: 'preview',
                            label: '预览',
                            icon: Eye,
                            run: (row) => {
                                selectedId = row.id;
                            },
                        },
                    ]"
                >
                    <template #cell-name="{ row }">
                        <button
                            class="group flex w-full items-start gap-3 rounded-sm text-left after:absolute after:inset-0"
                            :aria-label="`查看${row.name}`"
                            @click="selectedId = row.id"
                        >
                            <component :is="icon" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                            <span class="min-w-0">
                                <span class="block font-medium group-hover:underline group-focus-visible:underline">
                                    {{ row.name }}
                                </span>
                                <span class="mt-1 block text-xs text-muted-foreground">{{ row.description }}</span>
                            </span>
                        </button>
                    </template>
                    <template #cell-status="{ row }">
                        <StateBadge :tone="stateTone(row.status)">{{ row.status }}</StateBadge>
                    </template>
                </DataTable>
            </template>
        </ResourcePreview>
    </ResourcePage>
</template>
