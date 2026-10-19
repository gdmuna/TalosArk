<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { Plug, RotateCw } from '@lucide/vue';
import { useIntegrationDataSource, useIntegrationRead, readIntegrationCatalog } from '@/module/integration';
import { SelectField } from '@/component/select-field';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/ui/empty';
import { managementPath } from '@/router/management-navigation';
import { useQuerySelection } from '@/platform/navigation';
import ManagementPage from './component/ManagementPage.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import ManagementReadFeedback from './component/ManagementReadFeedback.vue';
import IntegrationDetail from './integration/Detail.vue';
import IntegrationLog from './integration/Log.vue';
import { integrationIcon, integrationState, integrationOwner } from './integration/presentation';
import { useManagementOrganization } from './useManagementOrganization';

const route = useRoute();
const router = useRouter();
const path = `${managementPath}/integration`;
const scope = useManagementOrganization(path);
const { organization, options, context } = scope;
const source = useIntegrationDataSource();
const views = [
    { value: 'management', label: '集成管理' },
    { value: 'log', label: '集成日志' },
];
const { value: selection, select: selectView } = useQuerySelection(views.map((item) => item.value));
function update(patch: LocationQueryRaw) {
    if (route.path === path)
        void router.replace({ path, query: { ...route.query, cursor: undefined, ...patch }, hash: route.hash });
}
const view = computed({
    get: () => selection.value,
    set: (value: string) => void selectView(value, { cursor: undefined }),
});
const organizationId = computed({
    get: () => scope.organizationId.value,
    set: (value: string) => {
        if (options.value.some((item) => item.value === value)) update({ organization: value, integration: undefined });
    },
});
const key = computed(() => (source && context.value ? JSON.stringify(context.value) : ''));
const { data, loading, error, refresh } = useIntegrationRead(key, async (signal) => {
    const selected = context.value;
    if (!source || !selected) return;
    return readIntegrationCatalog(selected.organizationId, await source.list(selected.organizationId, signal));
});
const selectedId = computed({
    get: () =>
        route.query.integration === undefined
            ? (data.value?.items[0]?.id ?? '')
            : typeof route.query.integration === 'string' &&
                route.query.integration.trim() &&
                route.query.integration.length <= 160
              ? route.query.integration
              : '',
    set: (id: string) => {
        const parameter = id === data.value?.items[0]?.id ? undefined : id;
        if (route.query.integration === parameter) return;
        const location = {
            path,
            query: { ...route.query, integration: parameter, cursor: undefined },
            hash: route.hash,
        };
        void (id === selectedId.value ? router.replace(location) : router.push(location));
    },
});
</script>

<template>
    <ManagementPage title="集成" layout="wide" :context="organization?.name ?? '组织不可用'">
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="集成视图" /></template>
        <template #actions>
            <div class="w-60 max-w-full [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-value]]:min-w-0">
                <SelectField v-model="organizationId" :options="options" label="当前管理组织" />
            </div>
            <Button v-if="source" variant="outline" :disabled="loading || !context" @click="refresh">
                <RotateCw aria-hidden="true" />
                刷新列表
            </Button>
        </template>
        <p v-if="!organization" role="alert" class="text-sm text-destructive">组织不存在或不在当前可访问范围内</p>
        <Empty v-else-if="!source" class="min-h-72 border-0">
            <EmptyHeader>
                <EmptyMedia variant="icon"><Plug aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>集成管理暂不可用</EmptyTitle>
                <EmptyDescription>集成查询服务尚未开放，部署连接仍由部署管理员维护。</EmptyDescription>
            </EmptyHeader>
        </Empty>
        <template v-else-if="context">
            <ManagementReadFeedback :loading="loading" :error="error" :stale="!!data" @retry="refresh" />
            <div v-if="!error || data" class="grid min-w-0 items-start gap-6 @4xl:grid-cols-[240px_minmax(0,1fr)]">
                <nav aria-label="集成列表" class="min-w-0 space-y-3 @4xl:border-r @4xl:pr-4">
                    <h2 class="text-sm font-medium">
                        集成列表
                        <span v-if="data" class="text-muted-foreground">{{ data.items.length }}</span>
                    </h2>
                    <div class="grid min-w-0 gap-1 @lg:grid-cols-2 @4xl:grid-cols-1">
                        <Button
                            v-for="item in data?.items ?? []"
                            :key="item.id"
                            variant="ghost"
                            :aria-pressed="selectedId === item.id"
                            aria-controls="integration-detail"
                            class="h-auto min-w-0 justify-start whitespace-normal px-3 py-3 text-left"
                            :class="selectedId === item.id && 'bg-neutral-selected'"
                            @click="selectedId = item.id"
                        >
                            <component
                                :is="integrationIcon(item.kind)"
                                class="size-5 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <span class="min-w-0 space-y-1">
                                <span class="block break-words font-medium">{{ item.name }}</span>
                                <span
                                    class="flex flex-wrap items-center gap-1 text-xs font-normal text-muted-foreground"
                                >
                                    <StateBadge :tone="integrationState[item.state].tone">
                                        {{ integrationState[item.state].label }}
                                    </StateBadge>
                                    {{ integrationOwner[item.owner] }}
                                </span>
                            </span>
                        </Button>
                    </div>
                    <p v-if="data && !data.items.length" class="text-sm text-muted-foreground">此组织没有可见的集成</p>
                </nav>
                <IntegrationDetail v-if="selectedId && view === 'management'" :id="selectedId" :context="context" />
                <section v-else-if="selectedId" id="integration-detail" class="min-w-0 space-y-4" aria-label="集成日志">
                    <h2 class="font-semibold">集成日志</h2>
                    <IntegrationLog :id="selectedId" :context="context" kind="activity" />
                </section>
                <p v-else-if="route.query.integration !== undefined" role="alert" class="text-sm text-destructive">
                    集成标识无效
                </p>
                <p v-else-if="!loading && !error" class="text-sm text-muted-foreground">请选择集成</p>
            </div>
        </template>
    </ManagementPage>
</template>
