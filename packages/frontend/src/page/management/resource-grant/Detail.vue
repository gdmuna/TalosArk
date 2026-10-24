<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    ArrowLeft,
    ArrowUpRight,
    Package,
    UserRound,
    GitBranch,
    KeyRound,
    Calendar,
    CircleDot,
    Eye,
    RotateCw,
} from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import {
    useResourceAccessDataSource,
    useResourceAccessRead,
    assertAccessScope,
    assertGrantScope,
    type ResourceGrant,
} from '@/module/resource-access';
import { HttpError } from '@/platform/http';
import { useNavigationStore } from '@/platform/navigation';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { CopyableId } from '@/component/inspector';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { ScrollSurface } from '@/component/scroll-surface';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import ManagementViewNav from '../component/ManagementViewNav.vue';
import ManagementSection from '../component/ManagementSection.vue';
import FactList from '../detail/FactList.vue';
import { useManagementView } from '../useManagementView';
import { resourceGrantPath, useAccessContext, accessReferenceTo } from './context';
import { accessDate, grantStates, grantValidity, principalKinds } from './presentation';
import GrantInspector from './GrantInspector.vue';
import ReadFeedback from './ReadFeedback.vue';
import Activity from './Activity.vue';

const route = useRoute(),
    router = useRouter(),
    navigation = useNavigationStore(),
    workspace = useWorkspaceStore();
const source = useResourceAccessDataSource();
const { scope, identity, key: contextKey, invalid, organization } = useAccessContext();
const id = computed(() => (typeof route.params.resourceId === 'string' ? route.params.resourceId : ''));
const key = computed(() =>
    source && contextKey.value && id.value ? JSON.stringify([contextKey.value, id.value]) : ''
);
const { data, loading, error, refresh } = useResourceAccessRead(key, async (signal) => {
    if (!source) return;
    const resourceId = id.value,
        selectedScope = scope.value;
    const next = await source.resource(selectedScope, resourceId, signal);
    assertAccessScope(selectedScope, next.organizationId, next.resource.workspace.id);
    if (next.resource.id !== resourceId || !Number.isFinite(Date.parse(next.measuredAt)))
        throw new HttpError('资源响应无效', 'protocol');
    next.grants.forEach((grant) =>
        assertGrantScope({ ...selectedScope, workspaceId: next.resource.workspace.id }, grant, resourceId)
    );
    return next;
});
const views = [
    { value: 'authorization', label: '授权概览' },
    { value: 'information', label: '基本信息' },
    { value: 'related', label: '关联实体' },
    { value: 'activity', label: '操作记录' },
];
const view = useManagementView(views);
const title = computed(() => data.value?.resource.name ?? '资源授权详情');
const listTo = computed(() => {
    const last = navigation.lastLocation(resourceGrantPath),
        query = router.resolve(last).query;
    return query.organization === scope.value.organizationId && query.workspace === scope.value.workspaceId
        ? last
        : router.resolve({
              path: resourceGrantPath,
              query: { organization: scope.value.organizationId, workspace: scope.value.workspaceId },
          }).fullPath;
});
watchEffect(() => {
    if (route.path.startsWith(`${resourceGrantPath}/`)) navigation.setPageLabel(route.path, title.value);
});
provideBreadcrumbs(() => [
    { id: 'management', label: '管理中心', to: '/main/management' },
    { id: 'resource-grant', label: '资源授权', to: listTo.value },
    { id: 'resource', label: title.value },
    { id: 'view', label: views.find((item) => item.value === view.value)?.label ?? '授权概览' },
]);
const previewId = ref<string | null>(null),
    previewOpen = ref(false);
watch(
    key,
    () => {
        previewId.value = null;
        previewOpen.value = false;
    },
    { flush: 'sync' }
);
watch(data, (value) => {
    if (!value?.grants.some((item) => item.id === previewId.value)) previewOpen.value = false;
});
function preview(row: ResourceGrant) {
    previewId.value = row.id;
    previewOpen.value = true;
}
const columns: DataTableColumn<ResourceGrant>[] = [
    { id: 'principal', label: '授权对象', size: 200, fill: true, icon: UserRound, value: (row) => row.principal.name },
    {
        id: 'permission',
        label: '权限',
        size: 160,
        icon: KeyRound,
        value: (row) => row.permissions.map((item) => item.label).join('、') || '未提供',
    },
    { id: 'basis', label: '来源', size: 180, icon: GitBranch, value: (row) => row.basis.label },
    { id: 'expiresAt', label: '有效期', size: 165, icon: Calendar, value: (row) => grantValidity(row.expiresAt) },
    { id: 'status', label: '状态', size: 100, icon: CircleDot, value: (row) => grantStates[row.status].label },
];
const bases = computed(() => [
    ...new Map(data.value?.grants.map((grant) => [grant.basis.id, grant.basis]) ?? []).values(),
]);
const contentTo = computed(() => {
    const resource = data.value?.resource;
    return resource?.content?.kind === 'material' &&
        workspace.activeId === resource.workspace.id &&
        workspace.organization?.id === scope.value.organizationId
        ? `/main/material/detail/${encodeURIComponent(resource.content.id)}`
        : undefined;
});
</script>
<template>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col" data-slot="resource-access-detail">
        <ScrollSurface class="min-h-0 flex-1" edge-effect="line">
            <header class="shrink-0 space-y-4 border-b px-4 pt-4 lg:px-6">
                <Button variant="ghost" size="sm" class="-ml-2" @click="navigation.returnTo(navigation.origin, listTo)">
                    <ArrowLeft aria-hidden="true" />
                    {{ navigation.origin?.label ?? '资源授权' }}
                </Button>
                <div class="flex flex-wrap items-start justify-between gap-4">
                    <div class="flex min-w-0 flex-1 items-start gap-4">
                        <div
                            class="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"
                        >
                            <Package class="size-6" aria-hidden="true" />
                        </div>
                        <div class="min-w-0 space-y-2">
                            <div class="flex flex-wrap items-center gap-3">
                                <h1 class="break-words text-xl font-semibold">{{ title }}</h1>
                                <StateBadge v-if="data" tone="neutral">
                                    {{ data.resource.archivedAt ? '已归档' : '未归档' }}
                                </StateBadge>
                            </div>
                            <CopyableId :value="id" label="资源 ID" />
                            <p v-if="data" class="break-words text-sm text-muted-foreground">
                                {{ data.resource.type.label }} · {{ data.resource.workspace.name }} ·
                                {{ organization?.name }}
                            </p>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <Button v-if="contentTo" variant="outline" as-child>
                            <RouterLink :to="contentTo">
                                <ArrowUpRight aria-hidden="true" />
                                资源详情
                            </RouterLink>
                        </Button>
                        <Button v-if="source" variant="outline" :disabled="loading || !key" @click="refresh">
                            <RotateCw aria-hidden="true" />
                            刷新
                        </Button>
                    </div>
                </div>
                <ManagementViewNav v-model="view" :items="views" label="资源授权详情视图" />
            </header>
            <main :aria-label="title" class="@container/access mx-auto w-full min-w-0 space-y-6 p-4 lg:p-6">
                <p v-if="invalid" role="alert" class="text-sm text-destructive">{{ invalid }}</p>
                <p v-else-if="!source" role="status" class="text-sm text-muted-foreground">资源授权查询服务尚未开放</p>
                <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取资源授权信息</p>
                <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
                <template v-if="data">
                    <template v-if="view === 'authorization'">
                        <dl class="grid min-w-0 gap-5 border-b pb-6 @min-[640px]/access:grid-cols-3">
                            <div class="space-y-2">
                                <dt class="text-sm text-muted-foreground">所属工作区</dt>
                                <dd class="break-words font-medium">{{ data.resource.workspace.name }}</dd>
                            </div>
                            <div class="space-y-2">
                                <dt class="text-sm text-muted-foreground">
                                    {{ data.complete ? '授权依据' : '本批授权依据' }}
                                </dt>
                                <dd class="text-xl font-semibold tabular-nums">{{ data.grants.length }}</dd>
                            </div>
                            <div class="space-y-2">
                                <dt class="text-sm text-muted-foreground">读取时间</dt>
                                <dd class="text-sm">{{ accessDate(data.measuredAt) }}</dd>
                            </div>
                        </dl>
                        <ManagementSection title="授权依据">
                            <p v-if="!data.complete" class="text-sm text-muted-foreground">
                                当前仅返回部分记录，不代表此资源的完整授权集合。
                            </p>
                            <DataTable
                                :key="key"
                                :data="data.grants"
                                :columns="columns"
                                :preview="preview"
                                :filtering="false"
                                :actions="[{ id: 'preview', label: '预览', icon: Eye, primary: true, run: preview }]"
                                empty-text="没有返回可展示的授权依据"
                            >
                                <template #cell-principal="{ row }">
                                    <div class="space-y-1">
                                        <span class="font-medium">{{ row.principal.name }}</span>
                                        <span class="block text-xs text-muted-foreground">
                                            {{ principalKinds[row.principal.kind] }}
                                        </span>
                                    </div>
                                </template>
                                <template #cell-status="{ row }">
                                    <StateBadge :tone="grantStates[row.status].tone">
                                        {{ grantStates[row.status].label }}
                                    </StateBadge>
                                </template>
                            </DataTable>
                        </ManagementSection>
                        <ManagementSection v-if="bases.length" title="来源说明">
                            <ul class="grid gap-x-8 gap-y-4 @min-[1000px]/access:grid-cols-2">
                                <li v-for="basis in bases" :key="basis.id" class="space-y-2 border-l-2 pl-4">
                                    <Button
                                        v-if="basis.reference"
                                        variant="link"
                                        class="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                                        as-child
                                    >
                                        <RouterLink :to="accessReferenceTo(scope, basis.reference)">
                                            {{ basis.label }}
                                        </RouterLink>
                                    </Button>
                                    <h3 v-else class="break-words text-sm font-medium">{{ basis.label }}</h3>
                                    <p
                                        v-if="basis.description"
                                        class="whitespace-pre-wrap break-words text-sm text-muted-foreground"
                                    >
                                        {{ basis.description }}
                                    </p>
                                </li>
                            </ul>
                        </ManagementSection>
                    </template>
                    <ManagementSection v-else-if="view === 'information'" title="资源基本信息">
                        <FactList
                            :fields="[
                                { label: '名称', value: data.resource.name },
                                { label: '编号', value: data.resource.code },
                                { label: '类型', value: data.resource.type.label },
                                { label: '所属工作区', value: data.resource.workspace.name },
                                ...data.facts,
                            ]"
                        />
                        <p v-if="data.resource.content && !contentTo" class="text-sm text-muted-foreground">
                            切换到资源所属工作区后可查看资源内容。
                        </p>
                    </ManagementSection>
                    <ManagementSection v-else-if="view === 'related'" title="关联实体">
                        <p v-if="data.related === null" class="text-sm text-muted-foreground">关联实体查询尚未开放</p>
                        <p v-else-if="!data.related.length" class="text-sm text-muted-foreground">
                            没有可展示的关联实体
                        </p>
                        <ul v-else class="divide-y">
                            <li v-for="(item, index) in data.related" :key="index" class="space-y-2 py-4 first:pt-0">
                                <Button
                                    v-if="item.reference"
                                    variant="link"
                                    class="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                                    as-child
                                >
                                    <RouterLink :to="accessReferenceTo(scope, item.reference)">
                                        {{ item.label }}
                                    </RouterLink>
                                </Button>
                                <p v-else class="break-words text-sm font-medium">{{ item.label }}</p>
                                <p
                                    v-if="item.description"
                                    class="whitespace-pre-wrap break-words text-sm text-muted-foreground"
                                >
                                    {{ item.description }}
                                </p>
                            </li>
                        </ul>
                    </ManagementSection>
                    <ManagementSection v-else title="操作记录">
                        <Activity :scope="scope" :resource-id="id" :context-key="key" :identity="identity" />
                    </ManagementSection>
                </template>
            </main>
        </ScrollSurface>
    </div>
    <GrantInspector
        :id="previewId"
        v-model:open="previewOpen"
        :scope="scope"
        :context-key="key"
        @detail="previewOpen = false"
    />
</template>
