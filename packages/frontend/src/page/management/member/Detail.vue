<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue';
import { refDebounced } from '@vueuse/core';
import type { MemberWorkspacePage } from '@talos-ark/contracts/team';
import type { PaginationState } from '@tanstack/vue-table';
import { useRoute, useRouter } from 'vue-router';
import { UserRound, ShieldCheck, Eye } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/ui/dialog';
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
import { useDetailRead, useDetailActivity, detailDate, memberStatus } from '../detail/read';
import { Field, FieldError, FieldLabel } from '@/ui/field';

const formFieldId = useId();

const route = useRoute(),
    router = useRouter(),
    navigation = useNavigationStore();
const id = computed(() => String(route.params.memberId ?? ''));
const organizationId = computed(() => (typeof route.query.organization === 'string' ? route.query.organization : ''));
const workspaceId = computed(() => (typeof route.query.workspace === 'string' ? route.query.workspace : undefined));
const selection = computed(() => ({ organizationId: organizationId.value, workspaceId: workspaceId.value }));
const key = computed(() =>
    organizationId.value ? `${organizationId.value}:${id.value}:${workspaceId.value ?? ''}` : ''
);
const source = useManagementDataSource();
const { data, loading, busy, error, syncError, pendingSync, refresh, write } = useDetailRead(key, (signal) =>
    source.member(selection.value, id.value, signal)
);
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const query = ref(''),
    search = refDebounced(query, 200);
watch(search, () => {
    pagination.value = { ...pagination.value, pageIndex: 0 };
});
const relationsKey = computed(() =>
    data.value ? `${key.value}:${JSON.stringify(pagination.value)}:${search.value}` : ''
);
const relations = useDetailRead(relationsKey, (signal) =>
    source.memberWorkspaces(
        selection.value,
        id.value,
        { page: pagination.value.pageIndex + 1, pageSize: pagination.value.pageSize, search: search.value },
        signal
    )
);
const relationRows = computed(() => relations.data.value?.items ?? []);
const relationTotal = ref(0);
watch(relations.data, (value) => {
    if (value) relationTotal.value = value.total;
});
watch(key, () => {
    relationTotal.value = 0;
});
const activityKey = computed(() => (data.value?.canReadActivity ? key.value : ''));
const activity = useDetailActivity(activityKey, (cursor, signal) =>
    source.activity(selection.value, 'member', id.value, { cursor, limit: 20 }, signal)
);
watch(key, () => {
    pagination.value = { ...pagination.value, pageIndex: 0 };
    query.value = '';
});
function searchMembers(search: string, page: number, signal: AbortSignal) {
    return source.members(selection.value, { search, page, pageSize: 25 }, signal);
}
const views = [
    { value: 'overview', label: '概览' },
    { value: 'identity', label: '组织身份' },
    { value: 'workspace', label: '工作区关系' },
    { value: 'activity', label: '最近活动' },
    { value: 'authorization', label: '角色授权来源' },
];
const view = useManagementView(views);
type Relation = MemberWorkspacePage['items'][number];
const columns: DataTableColumn<Relation>[] = [
    { id: 'name', label: '工作区', size: 280, fill: true, sortable: false, value: (row) => row.workspace.name },
    {
        id: 'role',
        label: '本区角色',
        size: 220,
        sortable: false,
        value: (row) => row.roles.map((role) => role.name).join('、') || '—',
    },
    { id: 'joined', label: '加入时间', size: 200, sortable: false, value: (row) => detailDate(row.joinedAt) },
    { id: 'status', label: '成员状态', size: 120, sortable: false, value: (row) => memberStatus(row.status) },
];
const facts = computed(() =>
    data.value
        ? [
              { label: '姓名', value: data.value.member.name },
              { label: '邮箱', value: data.value.member.email },
              { label: '所属组织', value: data.value.organization.name },
              { label: '成员状态', value: memberStatus(data.value.member.status) },
              { label: '加入时间', value: detailDate(data.value.member.joinedAt) },
              { label: '离开时间', value: detailDate(data.value.member.leftAt) },
              { label: '账户 ID', value: data.value.member.userId },
              {
                  label: '组织角色',
                  value: data.value.canReadOrganizationRoles
                      ? data.value.roles.map((role) => role.name).join('、') || '未分配'
                      : '无权查看',
              },
          ]
        : []
);
const grants = computed(() => {
    const current = data.value;
    if (!current || current.member.status !== 'ACTIVE') return [];
    return [
        ...current.roles.map((role) => ({
            role,
            scope: current.organization.name,
            workspaceId: null as string | null,
        })),
        ...relationRows.value
            .filter((item) => item.status === 'ACTIVE')
            .flatMap((item) =>
                item.roles.map((role) => ({ role, scope: item.workspace.name, workspaceId: item.workspaceId }))
            ),
    ];
});
const permissionName = (code: string) => data.value?.definitions.find((item) => item.code === code)?.name ?? code;
const bindingOpen = ref(false),
    selectedRoles = ref<string[]>([]);
const roleCatalogKey = computed(() => (bindingOpen.value && data.value?.canManageRoles ? key.value : ''));
const roleCatalog = useDetailRead(roleCatalogKey, (signal) =>
    source.team.load({ organizationId: organizationId.value }, { page: 1, pageSize: 1, search: '' }, signal)
);
const bindingDirty = computed(
    () =>
        bindingOpen.value &&
        [...selectedRoles.value].sort().join('\n') !==
            (data.value?.member.roles
                .map((item) => item.id)
                .sort()
                .join('\n') ?? '')
);
const guard = useDraftGuard(bindingDirty, () => {
    bindingOpen.value = false;
    selectedRoles.value = [];
});
watch(key, () => {
    bindingOpen.value = false;
    selectedRoles.value = [];
});
const organizationRoles = computed(
    () =>
        roleCatalog.data.value?.roles.filter(
            (role) =>
                role.scope === 'ORGANIZATION' &&
                (role.grantable || data.value?.member.roles.some((item) => item.id === role.id))
        ) ?? []
);
function editRoles() {
    selectedRoles.value = data.value?.member.roles.map((item) => item.id) ?? [];
    bindingOpen.value = true;
}
async function saveRoles() {
    const selection = { organizationId: organizationId.value },
        memberId = id.value,
        roleIds = [...selectedRoles.value];
    if (await write((signal) => source.team.mutate(selection, { kind: 'bind', id: memberId, roleIds }, signal))) {
        bindingOpen.value = false;
        void activity.refresh();
    }
}
function switchMember(next: string) {
    void navigation.pushPreservingOrigin({
        path: `/main/management/member/${next}`,
        query: { ...route.query, organization: organizationId.value },
    });
}
function openWorkspace(row: Relation) {
    void router.push({
        path: `/main/management/workspace/${row.workspaceId}`,
        query: { view: 'member', organization: organizationId.value },
    });
}
function openRole(roleId: string, scopeWorkspaceId?: string | null) {
    void router.push({
        path: `/main/management/role/${roleId}`,
        query: { organization: organizationId.value, workspace: scopeWorkspaceId ?? undefined },
    });
}
</script>
<template>
    <DetailPage
        :id="id"
        v-model="view"
        :title="data?.member.name ?? '成员详情'"
        :icon="UserRound"
        :subtitle="data ? `${data.organization.name} · ${data.member.email}` : undefined"
        :status="data ? memberStatus(data.member.status) : undefined"
        list-label="成员"
        list-path="/main/management/member"
        :views="views"
        :search="searchMembers"
        :loading="loading"
        :error="error || (!organizationId ? '缺少组织上下文，请从成员列表重新进入。' : '')"
        @retry="refresh"
        @select="switchMember"
    >
        <template #actions>
            <Button v-if="data?.canManageRoles" variant="outline" :disabled="busy || pendingSync" @click="editRoles">
                <ShieldCheck />
                分配组织角色
            </Button>
        </template>
        <template v-if="data">
            <DataSyncNotice
                scope="成员"
                :error="syncError"
                :pending="pendingSync"
                :busy="busy || loading"
                @retry="refresh"
            />
            <div
                v-if="view === 'workspace' && relations.error.value"
                role="alert"
                class="flex items-center gap-3 text-sm text-destructive"
            >
                {{ relations.error.value }}
                <Button variant="outline" size="sm" @click="relations.refresh">重试读取关系</Button>
            </div>
            <div
                v-if="view === 'overview'"
                class="grid min-w-0 gap-6 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
            >
                <ManagementSection title="组织身份">
                    <FactList
                        :fields="[
                            { label: '所属组织', value: data.organization.name },
                            { label: '成员状态', value: memberStatus(data.member.status) },
                            {
                                label: '组织角色',
                                value: data.canReadOrganizationRoles
                                    ? data.roles.map((role) => role.name).join('、') || '未分配'
                                    : '无权查看',
                            },
                            { label: '加入时间', value: detailDate(data.member.joinedAt) },
                        ]"
                    />
                </ManagementSection>
                <ManagementSection title="工作区关系">
                    <div class="divide-y">
                        <div
                            v-for="item in relationRows"
                            :key="item.id"
                            class="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                            <div class="min-w-0">
                                <Button variant="link" class="h-auto p-0" @click="openWorkspace(item)">
                                    {{ item.workspace.name }}
                                </Button>
                                <p class="mt-1 text-sm text-muted-foreground">
                                    {{ item.roles.map((role) => role.name).join('、') || '未分配角色' }}
                                </p>
                            </div>
                            <Badge variant="secondary">{{ memberStatus(item.status) }}</Badge>
                        </div>
                        <p v-if="relations.error.value" role="alert" class="py-3 text-sm text-destructive">
                            {{ relations.error.value }}
                            <Button variant="link" @click="relations.refresh">重试读取</Button>
                        </p>
                        <p v-else-if="!relationRows.length" class="py-6 text-sm text-muted-foreground">
                            {{ relations.loading.value ? '正在加载关系' : '当前授权范围没有工作区关系' }}
                        </p>
                        <Button variant="link" class="px-0" @click="view = 'workspace'">
                            全部可见关系 · {{ relations.data.value?.total ?? '—' }} 项
                        </Button>
                    </div>
                </ManagementSection>
                <ManagementSection title="最近活动">
                    <ActivityFeed v-if="data.canReadActivity" :activity="activity" />
                    <p v-else class="text-sm text-muted-foreground">当前账户无权查看管理活动</p>
                </ManagementSection>
                <ManagementSection title="当前页角色授权来源">
                    <div class="divide-y">
                        <div v-for="item in grants" :key="`${item.role.id}:${item.workspaceId}`" class="space-y-2 py-3">
                            <Button variant="link" class="h-auto p-0" @click="openRole(item.role.id, item.workspaceId)">
                                {{ item.role.name }}
                            </Button>
                            <p class="text-xs text-muted-foreground">{{ item.scope }}</p>
                            <p class="text-sm">
                                {{ item.role.permissions.map(permissionName).join('、') || '未授予权限' }}
                            </p>
                        </div>
                        <p v-if="!grants.length" class="py-6 text-sm text-muted-foreground">当前页没有可见角色绑定</p>
                    </div>
                </ManagementSection>
            </div>
            <ManagementSection v-else-if="view === 'identity'" title="组织身份">
                <FactList :fields="facts" />
            </ManagementSection>
            <DataTable
                v-else-if="view === 'workspace'"
                v-model:query="query"
                v-model:pagination="pagination"
                :server-total="relationTotal"
                :filtering="false"
                :data="relationRows"
                :busy="relations.loading.value"
                :columns="columns"
                :actions="[{ id: 'detail', label: '详情', icon: Eye, primary: true, run: openWorkspace }]"
                search-label="搜索工作区关系"
                :empty-text="
                    relations.error.value || (relations.loading.value ? '正在加载关系' : '当前授权范围没有工作区关系')
                "
            />
            <ManagementSection v-else-if="view === 'activity'" title="当前组织内的活动">
                <ActivityFeed v-if="data.canReadActivity" :activity="activity" />
                <p v-else class="text-sm text-muted-foreground">当前账户无权查看管理活动</p>
            </ManagementSection>
            <ManagementSection v-else-if="view === 'authorization'" title="当前页角色授权来源">
                <p class="text-sm text-muted-foreground">
                    工作区关系第 {{ pagination.pageIndex + 1 }} 页 · {{ relationRows.length }} 项 / 共
                    {{ relations.data.value?.total ?? '—' }} 项可见关系
                </p>
                <div class="divide-y">
                    <div
                        v-for="item in grants"
                        :key="`${item.role.id}:${item.workspaceId}`"
                        class="grid gap-3 py-4 @min-[640px]:grid-cols-[220px_minmax(0,1fr)]"
                    >
                        <div>
                            <Button variant="link" class="h-auto p-0" @click="openRole(item.role.id, item.workspaceId)">
                                {{ item.role.name }}
                            </Button>
                            <p class="mt-2 text-xs text-muted-foreground">{{ item.scope }}</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Badge v-for="code in item.role.permissions" :key="code" variant="secondary">
                                {{ permissionName(code) }}
                            </Badge>
                        </div>
                    </div>
                    <p v-if="!grants.length" class="py-6 text-sm text-muted-foreground">当前页没有可见角色绑定</p>
                </div>
            </ManagementSection>
        </template>
    </DetailPage>
    <Dialog :open="bindingOpen && !!data" @update:open="(value) => (bindingOpen = value)">
        <DialogContent :aria-describedby="undefined">
            <DialogHeader>
                <DialogTitle>分配组织角色</DialogTitle>
                <DialogDescription>{{ data?.organization.name }} · {{ data?.member.name }}</DialogDescription>
            </DialogHeader>
            <form class="space-y-4" @submit.prevent="saveRoles">
                <p v-if="roleCatalog.loading.value" role="status" class="text-sm text-muted-foreground">
                    正在加载可分配角色
                </p>
                <FieldError v-if="roleCatalog.error.value" role="alert" class="text-sm text-destructive">
                    {{ roleCatalog.error.value }}
                    <Button type="button" variant="link" @click="roleCatalog.refresh">重试读取</Button>
                </FieldError>
                <Field v-for="role in organizationRoles" :key="role.id" orientation="horizontal" class="items-start">
                    <Checkbox
                        :id="formFieldId + '-1' + '-' + role.id"
                        :model-value="selectedRoles.includes(role.id)"
                        :disabled="busy || roleCatalog.loading.value || !!roleCatalog.error.value"
                        @update:model-value="
                            (value) =>
                                (selectedRoles =
                                    value === true
                                        ? [...new Set([...selectedRoles, role.id])]
                                        : selectedRoles.filter((id) => id !== role.id))
                        "
                    />
                    <FieldLabel class="font-normal" :for="formFieldId + '-1' + '-' + role.id">
                        {{ role.name }}
                    </FieldLabel>
                </Field>
                <FieldError v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</FieldError>
                <DialogFooter>
                    <Button type="button" variant="outline" :disabled="busy" @click="bindingOpen = false">取消</Button>
                    <Button
                        :disabled="
                            busy ||
                            roleCatalog.loading.value ||
                            !roleCatalog.data.value ||
                            !!roleCatalog.error.value ||
                            !data?.canManageRoles ||
                            pendingSync
                        "
                    >
                        保存分配
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    <DraftDialog :open="guard.open.value" @decide="guard.decide" />
</template>
