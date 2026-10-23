<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    Calendar,
    UserRound,
    Activity,
    Package,
    Folders,
    Eye,
    ExternalLink,
    RotateCw,
    ChevronRight,
    ClipboardList,
} from '@lucide/vue';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import { useAuditDataSource, useAuditRead, assertAuditScope, type AuditRecord } from '@/module/audit';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { SelectField } from '@/component/select-field';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/ui/empty';
import ManagementPage from './component/ManagementPage.vue';
import EventInspector from './audit/EventInspector.vue';
import { auditListPath, useAuditQuery } from './audit/query';
import { Field, FieldLabel } from '@/ui/field';
const standaloneFieldId = useId();

const formFieldId = useId();

const route = useRoute(),
    router = useRouter(),
    account = useAccountStore(),
    workspace = useWorkspaceStore(),
    source = useAuditDataSource();
const identity = computed(() => account.profile?.id ?? '');
const { scope, query, invalid, key: queryKey, update } = useAuditQuery(identity);
const key = computed(() => (source && route.path === auditListPath ? queryKey.value : ''));
const { data, loading, error, refresh } = useAuditRead(key, async (signal) => {
    if (!source) return;
    const page = await source.list(scope.value, query.value, signal);
    assertAuditScope(scope.value, page.items);
    return page;
});
const context = computed(() => workspace.organizations.find((item) => item.id === scope.value.organizationId)?.name);
const organization = computed({
    get: () => scope.value.organizationId,
    set: (value: string) => void update({ organization: value, workspace: undefined, resource: undefined }),
});
const selectedWorkspace = computed({
    get: () => scope.value.workspaceId ?? 'organization',
    set: (value: string) =>
        void update({ workspace: value === 'organization' ? undefined : value, resource: undefined }),
});
const workspaceOptions = computed(() => [
    { value: 'organization', label: '整个组织' },
    ...workspace.workspaces
        .filter((item) => item.organizationId === scope.value.organizationId)
        .map((item) => ({ value: item.id, label: item.name })),
]);
const action = ref(''),
    resource = ref(''),
    from = ref(''),
    until = ref(''),
    formError = ref('');
function localTime(value?: string) {
    if (!value || !Number.isFinite(Date.parse(value))) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
watch(
    query,
    (value) => {
        action.value = value.action ?? '';
        resource.value = value.resourceId ?? '';
        from.value = localTime(value.from);
        until.value = localTime(value.until);
        formError.value = '';
    },
    { immediate: true }
);
function applyFilters() {
    if (
        (from.value && !Number.isFinite(Date.parse(from.value))) ||
        (until.value && !Number.isFinite(Date.parse(until.value)))
    ) {
        formError.value = '请选择有效的时间范围';
        return;
    }
    if (from.value && until.value && Date.parse(from.value) >= Date.parse(until.value)) {
        formError.value = '结束时间必须晚于开始时间';
        return;
    }
    void update({
        action: action.value.trim() || undefined,
        resource: resource.value.trim() || undefined,
        from: from.value ? new Date(from.value).toISOString() : undefined,
        until: until.value ? new Date(until.value).toISOString() : undefined,
    });
}
const limit = computed({
    get: () => String(query.value.limit),
    set: (value: string) => void update({ limit: value }),
});
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
    if (!value?.items.some((item) => item.id === previewId.value)) previewOpen.value = false;
});
function preview(row: AuditRecord) {
    previewId.value = row.id;
    previewOpen.value = true;
}
function openDetail(id: string) {
    previewOpen.value = false;
    void router.push({
        path: `${auditListPath}/${encodeURIComponent(id)}`,
        query: { organization: scope.value.organizationId, workspace: scope.value.workspaceId },
    });
}
const pagination = ref({ pageIndex: 0, pageSize: 100 });
const columns: DataTableColumn<AuditRecord>[] = [
    {
        id: 'time',
        label: '时间',
        size: 190,
        icon: Calendar,
        sortable: false,
        value: (row) => new Date(row.occurredAt).toLocaleString('zh-CN', { hour12: false }),
    },
    {
        id: 'actor',
        label: '操作者',
        size: 150,
        icon: UserRound,
        sortable: false,
        value: (row) => row.actor?.name ?? '操作者信息不可用',
    },
    { id: 'action', label: '动作', size: 180, icon: Activity, sortable: false, value: (row) => row.actionLabel },
    {
        id: 'resource',
        label: '关联资源',
        size: 260,
        fill: true,
        icon: Package,
        sortable: false,
        value: (row) => row.resources.map((item) => item.labelSnapshot).join('、') || '—',
    },
    {
        id: 'workspace',
        label: '工作区',
        size: 170,
        icon: Folders,
        sortable: false,
        value: (row) => row.workspace?.name ?? '组织级事件',
    },
];
</script>

<template>
    <ManagementPage title="审计日志" layout="table" :context="context">
        <template #actions>
            <Button v-if="source" variant="outline" :disabled="loading || !key" @click="refresh">
                <RotateCw aria-hidden="true" />
                刷新
            </Button>
        </template>
        <Empty v-if="!source" class="min-h-60 border-0">
            <EmptyHeader>
                <EmptyMedia variant="icon"><ClipboardList aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>审计日志暂不可用</EmptyTitle>
                <EmptyDescription>审计查询服务尚未开放</EmptyDescription>
            </EmptyHeader>
        </Empty>
        <template v-else>
            <div class="flex flex-wrap items-center gap-3">
                <SelectField
                    v-model="organization"
                    label="组织"
                    :options="workspace.organizations.map((item) => ({ value: item.id, label: item.name }))"
                    class="w-52"
                />
                <SelectField v-model="selectedWorkspace" label="审计范围" :options="workspaceOptions" class="w-52" />
            </div>
            <form class="flex flex-wrap items-end gap-3" @submit.prevent="applyFilters">
                <Field class="w-52 max-w-full">
                    <FieldLabel :for="formFieldId + '-1'">开始时间（含）</FieldLabel>
                    <Input
                        :id="formFieldId + '-1'"
                        v-model="from"
                        type="datetime-local"
                        aria-label="开始时间"
                        class="w-52"
                    />
                </Field>
                <Field class="w-52 max-w-full">
                    <FieldLabel :for="formFieldId + '-2'">结束时间（不含）</FieldLabel>
                    <Input
                        :id="formFieldId + '-2'"
                        v-model="until"
                        type="datetime-local"
                        aria-label="结束时间"
                        class="w-52"
                    />
                </Field>
                <Field class="w-52 max-w-full">
                    <FieldLabel :for="formFieldId + '-3'">动作标识</FieldLabel>
                    <Input
                        :id="formFieldId + '-3'"
                        v-model="action"
                        placeholder="全部动作"
                        maxlength="120"
                        class="w-48"
                    />
                </Field>
                <Field class="w-52 max-w-full">
                    <FieldLabel :for="formFieldId + '-4'">资源 ID</FieldLabel>
                    <Input
                        :id="formFieldId + '-4'"
                        v-model="resource"
                        placeholder="全部资源"
                        maxlength="160"
                        class="w-52"
                    />
                </Field>
                <Button type="submit" variant="outline">查询</Button>
                <Button
                    type="button"
                    variant="ghost"
                    @click="update({ action: undefined, resource: undefined, from: undefined, until: undefined })"
                >
                    重置
                </Button>
            </form>
            <p v-if="formError || invalid" role="alert" class="text-sm text-destructive">{{ formError || invalid }}</p>
            <div v-if="error" role="alert" class="flex flex-wrap items-center gap-3 text-sm text-destructive">
                <span>{{ error }}{{ data ? '，当前保留上次读取结果。' : '' }}</span>
                <Button variant="outline" size="sm" :disabled="loading" @click="refresh">重试读取</Button>
            </div>
            <DataTable
                v-model:pagination="pagination"
                :data="data?.items ?? []"
                :columns="columns"
                :busy="loading"
                :preview="preview"
                :actions="[
                    {
                        id: 'detail',
                        label: '详情',
                        icon: ExternalLink,
                        primary: true,
                        run: (row) => openDetail(row.id),
                    },
                    { id: 'preview', label: '预览', icon: Eye, run: preview },
                ]"
                :filtering="false"
                :searchable="false"
                :empty-text="loading ? '正在加载审计记录' : invalid || error || '当前范围没有审计记录'"
            >
                <template #footer>
                    <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span role="status" class="text-muted-foreground">本批 {{ data?.items.length ?? 0 }} 项</span>
                        <Field class="flex flex-wrap items-center">
                            <FieldLabel :for="standaloneFieldId + '-1'">每批</FieldLabel>
                            <SelectField
                                :id="standaloneFieldId + '-1'"
                                v-model="limit"
                                hide-title
                                label="每批条数"
                                :options="[20, 50, 100].map((size) => ({ value: String(size), label: `${size} 条` }))"
                                class="min-w-24 h-8"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                :disabled="loading || !query.cursor"
                                @click="update({})"
                            >
                                返回首批
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                :disabled="loading || !data?.nextCursor || !!error"
                                @click="update({ cursor: data?.nextCursor ?? undefined })"
                            >
                                下一批
                                <ChevronRight aria-hidden="true" />
                            </Button>
                        </Field>
                    </div>
                </template>
            </DataTable>
        </template>
    </ManagementPage>
    <EventInspector
        :id="previewId"
        v-model:open="previewOpen"
        :scope="scope"
        :identity="identity"
        @detail="openDetail"
    />
</template>
