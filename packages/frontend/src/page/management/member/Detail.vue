<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { UserRound, ShieldCheck, Eye } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/ui/dialog';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { DataSyncNotice } from '@/component/data-sync';
import { useNavigationStore } from '@/platform/navigation';
import DetailPage from '../detail/DetailPage.vue';
import FactList from '../detail/FactList.vue';
import ActivityList from '../detail/ActivityList.vue';
import DraftDialog from '../detail/DraftDialog.vue';
import { useDraftGuard } from '../detail/useDraftGuard';
import ManagementSection from '../component/ManagementSection.vue';
import { useManagementView } from '../useManagementView';
import { usePrototypeObject, detailDate, memberStatus, type MemberDetail } from '../detail/prototype';

const route = useRoute(),
    router = useRouter(),
    navigation = useNavigationStore();
const id = computed(() => String(route.params.memberId ?? ''));
const organizationId = computed(() => (typeof route.query.organization === 'string' ? route.query.organization : ''));
const key = computed(() => `${organizationId.value}:${id.value}`);
const { data, catalog, loading, busy, error, syncError, refresh, write } = usePrototypeObject(key, (source, signal) =>
    source.member(organizationId.value, id.value, signal)
);
const views = [
    { value: 'overview', label: '概览' },
    { value: 'identity', label: '组织身份' },
    { value: 'workspace', label: '工作区关系' },
    { value: 'activity', label: '最近活动' },
    { value: 'authorization', label: '角色授权来源' },
];
const view = useManagementView(views);
type Relation = MemberDetail['workspaces'][number];
const columns: DataTableColumn<Relation>[] = [
    { id: 'name', label: '工作区', size: 280, fill: true, value: (row) => row.workspace.name },
    { id: 'role', label: '本区角色', size: 220, value: (row) => row.roles.map((role) => role.name).join('、') || '—' },
    { id: 'joined', label: '加入时间', size: 200, value: (row) => detailDate(row.joinedAt) },
    { id: 'status', label: '成员状态', size: 120, value: (row) => memberStatus(row.status) },
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
              { label: '组织角色', value: data.value.roles.map((role) => role.name).join('、') || '—' },
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
        ...current.workspaces
            .filter((item) => item.status === 'ACTIVE')
            .flatMap((item) =>
                item.roles.map((role) => ({ role, scope: item.workspace.name, workspaceId: item.workspaceId }))
            ),
    ];
});
const permissionName = (code: string) => catalog.value?.definitions.find((item) => item.code === code)?.name ?? code;
const bindingOpen = ref(false),
    selectedRoles = ref<string[]>([]);
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
        catalog.value?.roles.filter(
            (role) =>
                role.organizationId === organizationId.value &&
                role.scope === 'ORGANIZATION' &&
                !role.archivedAt &&
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
    if (await write((source, signal) => source.team.mutate(selection, { kind: 'bind', id: memberId, roleIds }, signal)))
        bindingOpen.value = false;
}
function switchMember(next: string) {
    void router.push({
        path: `/main/management/member/${next}`,
        query: { ...route.query, organization: organizationId.value },
        state: { navigationOrigin: navigation.origin ? { ...navigation.origin } : null },
    });
}
function openWorkspace(row: Relation) {
    void router.push({ path: `/main/management/workspace/${row.workspaceId}`, query: { view: 'member' } });
}
function openRole(roleId: string) {
    void router.push({ path: `/main/management/role/${roleId}`, query: { organization: organizationId.value } });
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
        :options="
            catalog?.members
                .filter((item) => item.organizationId === organizationId)
                .map((item) => ({ id: item.id, name: item.name })) ?? []
        "
        :loading="loading"
        :error="error"
        @retry="refresh"
        @select="switchMember"
    >
        <template #actions>
            <Button v-if="data?.canManageRoles" variant="outline" :disabled="busy || !!syncError" @click="editRoles">
                <ShieldCheck />
                分配组织角色
            </Button>
        </template>
        <template v-if="data">
            <DataSyncNotice scope="模拟成员" :error="syncError" :busy="busy || loading" @retry="refresh" />
            <div
                v-if="view === 'overview'"
                class="grid min-w-0 gap-6 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
            >
                <ManagementSection title="组织身份">
                    <FactList
                        :fields="[
                            { label: '所属组织', value: data.organization.name },
                            { label: '成员状态', value: memberStatus(data.member.status) },
                            { label: '组织角色', value: data.roles.map((role) => role.name).join('、') || '—' },
                            { label: '加入时间', value: detailDate(data.member.joinedAt) },
                        ]"
                    />
                </ManagementSection>
                <ManagementSection title="工作区关系">
                    <div class="divide-y">
                        <div
                            v-for="item in data.workspaces"
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
                        <p v-if="!data.workspaces.length" class="py-6 text-sm text-muted-foreground">尚未加入工作区</p>
                    </div>
                </ManagementSection>
                <ManagementSection title="最近活动">
                    <ActivityList :items="data.activities.slice(0, 5)" />
                </ManagementSection>
                <ManagementSection title="角色授权来源">
                    <div class="divide-y">
                        <div v-for="item in grants" :key="`${item.role.id}:${item.workspaceId}`" class="space-y-2 py-3">
                            <Button variant="link" class="h-auto p-0" @click="openRole(item.role.id)">
                                {{ item.role.name }}
                            </Button>
                            <p class="text-xs text-muted-foreground">{{ item.scope }}</p>
                            <p class="text-sm">
                                {{ item.role.permissions.map(permissionName).join('、') || '未授予权限' }}
                            </p>
                        </div>
                        <p v-if="!grants.length" class="py-6 text-sm text-muted-foreground">当前没有角色绑定</p>
                    </div>
                </ManagementSection>
            </div>
            <ManagementSection v-else-if="view === 'identity'" title="组织身份">
                <FactList :fields="facts" />
            </ManagementSection>
            <DataTable
                v-else-if="view === 'workspace'"
                :data="data.workspaces"
                :columns="columns"
                :actions="[{ id: 'detail', label: '详情', icon: Eye, primary: true, run: openWorkspace }]"
                empty-text="尚未加入工作区"
            />
            <ManagementSection v-else-if="view === 'activity'" title="当前组织内的活动">
                <ActivityList :items="data.activities" />
            </ManagementSection>
            <ManagementSection v-else-if="view === 'authorization'" title="角色授权来源">
                <div class="divide-y">
                    <div
                        v-for="item in grants"
                        :key="`${item.role.id}:${item.workspaceId}`"
                        class="grid gap-3 py-4 @min-[640px]:grid-cols-[220px_minmax(0,1fr)]"
                    >
                        <div>
                            <Button variant="link" class="h-auto p-0" @click="openRole(item.role.id)">
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
                    <p v-if="!grants.length" class="py-6 text-sm text-muted-foreground">当前没有角色绑定</p>
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
                <label v-for="role in organizationRoles" :key="role.id" class="flex items-start gap-3 text-sm">
                    <Checkbox
                        :model-value="selectedRoles.includes(role.id)"
                        :disabled="busy"
                        @update:model-value="
                            (value) =>
                                (selectedRoles =
                                    value === true
                                        ? [...new Set([...selectedRoles, role.id])]
                                        : selectedRoles.filter((id) => id !== role.id))
                        "
                    />
                    <span>{{ role.name }}</span>
                </label>
                <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
                <DialogFooter>
                    <Button type="button" variant="outline" :disabled="busy" @click="bindingOpen = false">取消</Button>
                    <Button :disabled="busy || !data?.canManageRoles || !!syncError">保存模拟分配</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    <DraftDialog :open="guard.open.value" @decide="guard.decide" />
</template>
