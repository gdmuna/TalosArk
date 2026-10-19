<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Eye, FileBox, RefreshCw } from '@lucide/vue';
import {
    useFacilityGovernanceDataSource,
    useFacilityRead,
    assertFacilityScope,
    type FacilityDetail,
    type FacilityTemplate,
} from '@/module/facility';
import { HttpError } from '@/platform/http';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { SheetInspector } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';
import ManagementSection from '../component/ManagementSection.vue';
import FactList from '../detail/FactList.vue';
import ReadFeedback from './ReadFeedback.vue';
import { facilityDate } from './context';
const props = defineProps<{ facility: FacilityDetail; contextKey: string; view: string }>();
const source = useFacilityGovernanceDataSource();
const key = computed(() => (source && props.contextKey ? JSON.stringify([props.contextKey, props.facility.id]) : ''));
const { data, loading, error, refresh } = useFacilityRead(key, async (signal) => {
    if (!source) return;
    const scope = { organizationId: props.facility.organizationId },
        id = props.facility.id;
    const result = await source.read(scope, id, signal);
    assertFacilityScope(scope, result);
    if (result.facilityId !== id || !Number.isFinite(Date.parse(result.measuredAt)))
        throw new HttpError('治理响应范围无效', 'protocol');
    for (const template of result.templates ?? []) {
        const ids = new Map(template.structure.map((node) => [node.id, node]));
        if (ids.size !== template.structure.length) throw new HttpError('模板节点重复', 'protocol');
        for (const node of template.structure) {
            const visited = new Set<string>([node.id]);
            let parent = node.parentId;
            while (parent !== null) {
                const parentNode = ids.get(parent);
                if (visited.has(parent) || !parentNode) throw new HttpError('模板结构无效', 'protocol');
                visited.add(parent);
                parent = parentNode.parentId;
            }
        }
    }
    return result;
});
const selectedId = ref('');
const selected = computed(() => data.value?.templates?.find((item) => item.id === selectedId.value));
const open = ref(false);
watch(
    [key, () => props.view],
    () => {
        selectedId.value = '';
        open.value = false;
    },
    { flush: 'sync' }
);
watch(
    selected,
    (value) => {
        if (!value) open.value = false;
    },
    { flush: 'sync' }
);
function preview(row: FacilityTemplate) {
    selectedId.value = row.id;
    open.value = true;
}
const templateRows = computed(() => {
    const nodes = selected.value?.structure ?? [];
    const ordered: { id: string; name: string; type: string; depth: number }[] = [];
    function append(parentId: string | null, depth: number) {
        for (const node of nodes.filter((item) => item.parentId === parentId)) {
            ordered.push({ ...node, depth });
            append(node.id, depth + 1);
        }
    }
    append(null, 0);
    return ordered;
});
const columns: DataTableColumn<FacilityTemplate>[] = [
    { id: 'name', label: '模板名称', size: 260, fill: true, value: (row) => row.name },
    { id: 'version', label: '版本', size: 120, value: (row) => row.version },
    { id: 'types', label: '适用节点类型', size: 240, value: (row) => row.nodeTypes.join('、') },
    { id: 'status', label: '状态', size: 130, value: (row) => row.status },
    { id: 'updatedAt', label: '最近更新', size: 200, value: (row) => facilityDate(row.updatedAt) },
];
</script>
<template>
    <div class="space-y-6">
        <p v-if="!source" role="status" class="py-8 text-sm text-muted-foreground">
            设施规则与模板查询尚未开放，现有设施结构仍可查看。
        </p>
        <template v-else>
            <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-muted-foreground">
                    {{ data ? `读取时间：${facilityDate(data.measuredAt)}` : '设施治理资料' }}
                </p>
                <Button variant="outline" size="sm" :disabled="loading || !key" @click="refresh">
                    <RefreshCw aria-hidden="true" />
                    刷新
                </Button>
            </div>
            <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取治理资料</p>
            <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
            <template v-if="data">
                <p v-if="!data.complete" class="text-sm text-muted-foreground">当前仅展示部分可见治理资料</p>
                <template v-if="view === 'rule'">
                    <p v-if="data.rules === null" class="text-sm text-muted-foreground">此范围的治理规则尚未提供</p>
                    <p v-else-if="!data.rules.length" class="text-sm text-muted-foreground">没有可展示的治理规则</p>
                    <ManagementSection v-for="rule in data.rules ?? []" :key="rule.id" :title="rule.name">
                        <p class="break-words text-sm text-muted-foreground">
                            适用范围：{{ rule.scope }} · 来源：{{ rule.origin }}
                        </p>
                        <FactList :fields="rule.facts" />
                    </ManagementSection>
                </template>
                <template v-else>
                    <p v-if="data.templates === null" class="text-sm text-muted-foreground">此范围的模板目录尚未提供</p>
                    <DataTable
                        v-else
                        :data="data.templates"
                        :columns="columns"
                        :preview="preview"
                        :actions="[{ id: 'preview', label: '预览', icon: Eye, primary: true, run: preview }]"
                        search-label="搜索模板名称或节点类型"
                        empty-text="没有可展示的治理模板"
                    />
                    <p v-if="selectedId && !selected" role="status" class="text-sm text-muted-foreground">
                        模板不在当前可见目录内
                    </p>
                </template>
                <ul v-if="data.notes.length" class="space-y-2 border-t pt-4 text-sm text-muted-foreground">
                    <li v-for="(note, index) in data.notes" :key="index" class="break-words">{{ note }}</li>
                </ul>
            </template>
        </template>
    </div>
    <SheetInspector v-model:open="open" title="治理模板预览" description="模板版本、适用范围与层级结构，不执行套用">
        <header class="space-y-2 border-b p-6 pr-12">
            <FileBox class="size-5 text-primary" aria-hidden="true" />
            <h2 class="break-words text-lg font-semibold">{{ selected?.name ?? '模板预览' }}</h2>
            <p class="text-sm text-muted-foreground">{{ selected?.version }}</p>
        </header>
        <ScrollSurface class="min-h-0 flex-1" edge-effect="line">
            <div v-if="selected" class="space-y-6 p-6">
                <p v-if="selected.description" class="break-words text-sm text-muted-foreground">
                    {{ selected.description }}
                </p>
                <FactList :fields="selected.facts" />
                <ManagementSection title="层级预览">
                    <p v-if="!templateRows.length" class="text-sm text-muted-foreground">没有结构预览</p>
                    <ol v-else class="space-y-3">
                        <li
                            v-for="node in templateRows"
                            :key="node.id"
                            :style="{ marginLeft: `${Math.min(node.depth, 6) * 12}px` }"
                            class="border-l pl-3"
                        >
                            <p class="break-words text-sm font-medium">{{ node.name }}</p>
                            <p class="text-xs text-muted-foreground">{{ node.type }}</p>
                        </li>
                    </ol>
                </ManagementSection>
            </div>
        </ScrollSurface>
    </SheetInspector>
</template>
