<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { refDebounced } from '@vueuse/core';
import type { PaginationState } from '@tanstack/vue-table';
import type { RoleBindingPage } from '@talos-ark/contracts/team';
import { useRoute, useRouter } from 'vue-router';
import { ShieldCheck, Eye } from '@lucide/vue';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { DataSyncNotice } from '@/component/data-sync';
import { useNavigationStore } from '@/platform/navigation';
import { useManagementDataSource } from '@/module/workspace';
import DetailPage from '../detail/DetailPage.vue';
import FactList from '../detail/FactList.vue';
import ActivityFeed from '../detail/ActivityFeed.vue';
import DraftDialog from '../detail/DraftDialog.vue';
import { useDraftGuard } from '../detail/useDraftGuard';
import ManagementSection from '../component/ManagementSection.vue';
import { useManagementView } from '../useManagementView';
import { useDetailRead, useDetailActivity, detailDate } from '../detail/read';
import PermissionMatrix from './PermissionMatrix.vue';

const route = useRoute(),
    router = useRouter(),
    navigation = useNavigationStore();
const id = computed(() => String(route.params.roleId ?? ''));
const organizationId = computed(() => (typeof route.query.organization === 'string' ? route.query.organization : ''));
const workspaceId = computed(() => (typeof route.query.workspace === 'string' ? route.query.workspace : undefined));
const selection = computed(() => ({ organizationId: organizationId.value, workspaceId: workspaceId.value }));
const key = computed(() =>
    organizationId.value ? `${organizationId.value}:${id.value}:${workspaceId.value ?? ''}` : ''
);
const source = useManagementDataSource();
const { data, loading, busy, error, syncError, pendingSync, refresh, write } = useDetailRead(key, (signal) =>
    source.role(selection.value, id.value, signal)
);
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const query = ref(''),
    search = refDebounced(query, 200);
watch(search, () => {
    pagination.value = { ...pagination.value, pageIndex: 0 };
});
const bindingsKey = computed(() =>
    data.value?.canReadBindings ? `${key.value}:${JSON.stringify(pagination.value)}:${search.value}` : ''
);
const bindings = useDetailRead(bindingsKey, (signal) =>
    source.bindings(
        selection.value,
        id.value,
        { search: search.value, page: pagination.value.pageIndex + 1, pageSize: pagination.value.pageSize },
        signal
    )
);
const bindingTotal = ref(0);
watch(bindings.data, (value) => {
    if (value) bindingTotal.value = value.total;
});
watch(key, () => {
    bindingTotal.value = 0;
});
const activityKey = computed(() => (data.value?.canReadActivity ? key.value : ''));
const activity = useDetailActivity(activityKey, (cursor, signal) =>
    source.activity(selection.value, 'role', id.value, { cursor, limit: 20 }, signal)
);
watch(key, () => {
    pagination.value = { ...pagination.value, pageIndex: 0 };
    query.value = '';
});
function searchRoles(search: string, page: number, signal: AbortSignal) {
    return source.roles(
        selection.value,
        { search, page, pageSize: 25, scope: workspaceId.value ? 'WORKSPACE' : undefined },
        signal
    );
}
const views = [
    { value: 'permission', label: '权限矩阵' },
    { value: 'member', label: '关联成员' },
    { value: 'activity', label: '变更记录' },
];
const view = useManagementView(views);
const name = ref(''),
    permissions = ref<string[]>([]),
    saved = ref(false);
watch(data, (value) => {
    name.value = value?.role.name ?? '';
    permissions.value = [...(value?.role.permissions ?? [])];
});
const dirty = computed(
    () =>
        !!data.value &&
        (name.value !== data.value.role.name ||
            [...permissions.value].sort().join('\n') !== [...data.value.role.permissions].sort().join('\n'))
);
function discard() {
    name.value = data.value?.role.name ?? '';
    permissions.value = [...(data.value?.role.permissions ?? [])];
    saved.value = false;
}
const guard = useDraftGuard(dirty, discard);
watch(key, () => {
    saved.value = false;
});
watch(
    [name, permissions],
    () => {
        saved.value = false;
    },
    { flush: 'sync' }
);
const scopeName = computed(() => (data.value?.role.scope === 'ORGANIZATION' ? '组织' : '工作区'));
type Binding = RoleBindingPage['items'][number];
const columns: DataTableColumn<Binding>[] = [
    { id: 'name', label: '成员', size: 220, fill: true, sortable: false, value: (row) => row.member.name },
    { id: 'email', label: '邮箱', size: 260, sortable: false, value: (row) => row.member.email },
    {
        id: 'scope',
        label: '绑定范围',
        size: 240,
        sortable: false,
        value: (row) => row.workspace?.name ?? data.value?.organization.name ?? '—',
    },
    { id: 'joined', label: '绑定建立时间', size: 200, sortable: false, value: (row) => detailDate(row.createdAt) },
];
function openMember(binding: Binding) {
    void router.push({
        path: `/main/management/member/${binding.member.id}`,
        query: { organization: organizationId.value, workspace: binding.workspace?.id },
    });
}
function switchRole(next: string) {
    void navigation.pushPreservingOrigin({
        path: `/main/management/role/${next}`,
        query: { ...route.query, organization: organizationId.value },
    });
}
async function save() {
    if (!data.value) return;
    const roleId = id.value,
        selection = { organizationId: organizationId.value },
        role = {
            name: name.value.trim(),
            permissions: [...permissions.value],
            expectedUpdatedAt: data.value.role.updatedAt,
        };
    saved.value = await write((signal) =>
        source.team.mutate(selection, { kind: 'update-role', id: roleId, role }, signal)
    );
    if (saved.value) void activity.refresh();
}
</script>
<template>
    <DetailPage
        :id="id"
        v-model="view"
        :title="data?.role.name ?? '角色详情'"
        :icon="ShieldCheck"
        :subtitle="data ? `${data.organization.name} · ${scopeName}角色定义 · ${data.role.code}` : undefined"
        :status="data ? (data.role.protected ? '系统保护' : '自定义角色') : undefined"
        list-label="角色与权限"
        list-path="/main/management/role"
        :views="views"
        :search="searchRoles"
        :loading="loading"
        :error="error || (!organizationId ? '缺少组织上下文，请从角色列表重新进入。' : '')"
        @retry="refresh"
        @select="switchRole"
    >
        <template v-if="data" #actions>
            <Badge v-if="data.bindingTotal !== null" variant="secondary">{{ data.bindingTotal }} 项有效绑定</Badge>
        </template>
        <template v-if="data">
            <DataSyncNotice
                scope="角色"
                :error="syncError"
                :pending="pendingSync"
                :busy="busy || loading"
                @retry="refresh"
            />
            <div
                v-if="view === 'member' && bindings.error.value"
                role="alert"
                class="flex items-center gap-3 text-sm text-destructive"
            >
                {{ bindings.error.value }}
                <Button variant="outline" size="sm" @click="bindings.refresh">重试读取绑定</Button>
            </div>
            <form v-if="view === 'permission'" class="space-y-6" @submit.prevent="save">
                <ManagementSection title="角色定义">
                    <label v-if="data.canEdit" class="grid max-w-[480px] gap-2 text-sm">
                        角色名称
                        <Input v-model="name" required maxlength="40" :disabled="busy" />
                    </label>
                    <FactList v-else :fields="[{ label: '角色名称', value: data.role.name }]" />
                </ManagementSection>
                <ManagementSection title="已注册权限">
                    <PermissionMatrix
                        :key="id"
                        v-model="permissions"
                        :definitions="data.definitions"
                        :scope="scopeName"
                        :disabled="!data.canEdit || busy || pendingSync"
                    />
                </ManagementSection>
                <FactList
                    :fields="[
                        { label: '创建时间', value: detailDate(data.role.createdAt) },
                        { label: '更新时间', value: detailDate(data.role.updatedAt) },
                    ]"
                />
                <p v-if="saved && !dirty" role="status" class="text-sm text-success-foreground">角色定义已保存</p>
                <div v-if="data.canEdit" class="flex gap-2">
                    <Button :disabled="!dirty || busy || pendingSync">{{ busy ? '保存中' : '保存更改' }}</Button>
                    <Button
                        type="button"
                        variant="outline"
                        :disabled="!dirty || busy"
                        @click="
                            name = data.role.name;
                            permissions = [...data.role.permissions];
                        "
                    >
                        取消
                    </Button>
                </div>
            </form>
            <DataTable
                v-else-if="view === 'member' && data.canReadBindings"
                v-model:query="query"
                v-model:pagination="pagination"
                :server-total="bindingTotal"
                :filtering="false"
                :data="bindings.data.value?.items ?? []"
                :busy="bindings.loading.value"
                :columns="columns"
                :actions="[{ id: 'detail', label: '详情', icon: Eye, primary: true, run: openMember }]"
                search-label="搜索关联成员"
                :empty-text="
                    bindings.error.value || (bindings.loading.value ? '正在加载绑定' : '当前授权范围没有有效成员绑定')
                "
            />
            <p v-else-if="view === 'member'" class="text-sm text-muted-foreground">当前账户无权查看成员绑定</p>
            <ManagementSection v-else-if="view === 'activity'" title="角色变更记录">
                <ActivityFeed v-if="data.canReadActivity" :activity="activity" />
                <p v-else class="text-sm text-muted-foreground">当前账户无权查看角色变更记录</p>
            </ManagementSection>
        </template>
    </DetailPage>
    <DraftDialog :open="guard.open.value" @decide="guard.decide" />
</template>
