<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Network, RotateCw, ExternalLink } from '@lucide/vue';
import { useFacilityDataSource, useFacilityRead, assertFacilityDetail, assertFacilityPage } from '@/module/facility';
import { SelectField } from '@/component/select-field';
import { Button } from '@/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/ui/empty';
import ManagementPage from './component/ManagementPage.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import DetailPicker from './detail/DetailPicker.vue';
import StorageBrowser from '../inventory/component/InventoryStorageBrowser.vue';
import GovernanceRead from './facility/GovernanceRead.vue';
import ReadFeedback from './facility/ReadFeedback.vue';
import { facilityPath, governancePath, useFacilityContext } from './facility/context';
import { useManagementView } from './useManagementView';

const route = useRoute(),
    router = useRouter(),
    source = useFacilityDataSource();
const { scope, organization, invalid, key: contextKey, options, organizationId, update } = useFacilityContext();
const id = computed(() => (typeof route.query.facility === 'string' ? route.query.facility : ''));
const key = computed(() =>
    source && contextKey.value && route.path === governancePath && id.value
        ? JSON.stringify([contextKey.value, id.value])
        : ''
);
const { data, loading, error, refresh } = useFacilityRead(key, async (signal) => {
    if (!source) return;
    const requestedScope = scope.value,
        requestedId = id.value;
    const result = await source.detail(requestedScope, requestedId, signal);
    assertFacilityDetail(requestedScope, requestedId, result);
    return result;
});
const views = [
    { value: 'structure', label: '设施结构' },
    { value: 'rule', label: '治理规则' },
    { value: 'template', label: '模板管理' },
];
const view = useManagementView(views);
async function search(query: string, page: number, signal: AbortSignal) {
    if (!source || !contextKey.value) return { items: [], total: 0 };
    const requestedScope = scope.value;
    const request = { q: query || undefined, page, pageSize: 20 };
    const result = await source.list(requestedScope, request, signal);
    assertFacilityPage(requestedScope, request, result);
    return { items: result.items.map((item) => ({ id: item.id, name: item.name })), total: result.total };
}
function select(next: string) {
    void update({ facility: next, topology: undefined, node: undefined, template: undefined });
}
</script>
<template>
    <ManagementPage title="存储设施治理" layout="tool" :context="organization?.name ?? '组织不可用'">
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="存储设施治理视图" /></template>
        <template #actions>
            <SelectField v-model="organizationId" :options="options" label="组织" hide-title class="w-56 max-w-full" />
            <Button v-if="source && id" variant="outline" :disabled="loading || !key" @click="refresh">
                <RotateCw aria-hidden="true" />
                刷新
            </Button>
        </template>
        <p v-if="invalid" role="alert" class="text-sm text-destructive">{{ invalid }}</p>
        <Empty v-else-if="!source" class="min-h-72 border-0">
            <EmptyHeader>
                <EmptyMedia variant="icon"><Network aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>设施治理暂不可用</EmptyTitle>
                <EmptyDescription>设施与存储节点查询服务尚未开放，不影响既有组织资料。</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" as-child>
                <RouterLink :to="{ path: facilityPath, query: { organization: scope.organizationId } }">
                    查看设施
                </RouterLink>
            </Button>
        </Empty>
        <template v-else>
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                    <span class="shrink-0 text-sm text-muted-foreground">设施</span>
                    <DetailPicker
                        :key="contextKey"
                        :label="data?.name ?? '选择设施'"
                        :active-id="id"
                        :search="search"
                        @select="select"
                    />
                </div>
                <Button
                    v-if="data"
                    variant="outline"
                    size="sm"
                    @click="
                        router.push({
                            path: `${facilityPath}/${encodeURIComponent(data.id)}`,
                            query: { organization: scope.organizationId },
                        })
                    "
                >
                    <ExternalLink aria-hidden="true" />
                    设施详情
                </Button>
            </div>
            <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
            <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取设施</p>
            <p v-if="!id" class="py-12 text-center text-sm text-muted-foreground">
                选择设施查看存储结构、治理规则和模板
            </p>
            <template v-if="data">
                <StorageBrowser
                    v-if="view === 'structure'"
                    :facility="data"
                    :context-key="key"
                    @changed="refresh"
                    @relocated="(facility, node) => update({ facility, node, topology: undefined })"
                />
                <GovernanceRead v-else :facility="data" :context-key="key" :view="view" />
            </template>
        </template>
    </ManagementPage>
</template>
