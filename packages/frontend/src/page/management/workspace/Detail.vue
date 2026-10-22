<script setup lang="ts">
import { computed, reactive, ref, watch, useId } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Folders, Users, Pencil, FlaskConical, Package, Monitor, Building2 } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Avatar, AvatarFallback } from '@/ui/avatar';
import { DataSyncNotice } from '@/component/data-sync';
import { TeamManagement } from '@/module/workspace/ui';
import { useWorkspaceStore, useManagementDataSource, createTeamManagementState } from '@/module/workspace';
import { useNavigationStore } from '@/platform/navigation';
import DetailPage from '../detail/DetailPage.vue';
import FactList from '../detail/FactList.vue';
import ActivityFeed from '../detail/ActivityFeed.vue';
import DraftDialog from '../detail/DraftDialog.vue';
import { useDraftGuard } from '../detail/useDraftGuard';
import ManagementSection from '../component/ManagementSection.vue';
import { useManagementView } from '../useManagementView';
import { useDetailRead, useDetailActivity, detailDate } from '../detail/read';
import { useMaterialDataSource } from '@/module/material';
import WorkspaceResource from './Resource.vue';
import FacilityAccess from './FacilityAccess.vue';
import { Field, FieldDescription, FieldLabel } from '@/ui/field';

const formFieldId = useId();

const route = useRoute(),
    router = useRouter(),
    navigation = useNavigationStore();
const id = computed(() => String(route.params.workspaceId ?? ''));
const workspace = useWorkspaceStore();
const source = useManagementDataSource();
const materialSource = useMaterialDataSource();
const organizationId = computed(() =>
    typeof route.query.organization === 'string'
        ? route.query.organization
        : (workspace.workspaces.find((item) => item.id === id.value)?.organizationId ?? '')
);
const selection = computed(() => ({ organizationId: organizationId.value, workspaceId: id.value }));
const key = computed(() => (organizationId.value ? `${organizationId.value}:${id.value}` : ''));
const { data, loading, busy, error, syncError, pendingSync, refresh, write } = useDetailRead(
    key,
    (signal) => source.workspace(selection.value, signal),
    (signal) => workspace.load(signal)
);
const resources = useDetailRead(key, (signal) => materialSource.overview(selection.value, signal));
const activityKey = computed(() => (data.value?.canReadActivity ? key.value : ''));
const activity = useDetailActivity(activityKey, (cursor, signal) =>
    source.activity(selection.value, 'workspace', id.value, { cursor, limit: 20 }, signal)
);
const views = [
    { value: 'overview', label: '概览' },
    { value: 'member', label: '成员' },
    { value: 'role', label: '角色' },
    { value: 'resource', label: '资源' },
    { value: 'sharing', label: '共享' },
    { value: 'setting', label: '设置' },
];
const view = useManagementView(views);
const model = reactive(createTeamManagementState(workspace));
model.connect(source.team);
const teamContext = computed(() => ({
    team: model,
    catalog: workspace,
    selection: { organizationId: data.value?.organization.id ?? '', workspaceId: id.value },
    roleBindings: data.value?.roleBindings ?? {},
    onMemberDetail: (memberId: string) => {
        const membership = model.data?.members.find((item) => item.id === memberId);
        if (membership)
            void router.push({
                path: `/main/management/member/${membership.organizationMemberId}`,
                query: { organization: organizationId.value, workspace: id.value },
            });
    },
    onRoleDetail: (roleId: string) => {
        void router.push({
            path: `/main/management/role/${roleId}`,
            query: { organization: organizationId.value, workspace: id.value },
        });
    },
}));
watch(
    () => model.data,
    () => {
        if (model.data) void refresh();
    }
);
const name = ref(''),
    description = ref(''),
    saved = ref(false);
watch(data, (value) => {
    name.value = value?.workspace.name ?? '';
    description.value = value?.workspace.description ?? '';
});
const dirty = computed(
    () =>
        !!data.value &&
        (name.value !== data.value.workspace.name || description.value !== data.value.workspace.description)
);
function discard() {
    name.value = data.value?.workspace.name ?? '';
    description.value = data.value?.workspace.description ?? '';
    saved.value = false;
}
const guard = useDraftGuard(dirty, discard);
watch(id, () => {
    saved.value = false;
});
watch(
    [name, description],
    () => {
        saved.value = false;
    },
    { flush: 'sync' }
);
const resourceKinds = [
    { kind: 'material', label: '材料', icon: FlaskConical },
    { kind: 'stock', label: '库存', icon: Package },
    { kind: 'equipment', label: '设备', icon: Monitor },
    { kind: 'facility', label: '设施', icon: Building2 },
];
function openMember(memberId: string) {
    void router.push({
        path: `/main/management/member/${memberId}`,
        query: { organization: organizationId.value, workspace: id.value },
    });
}
function switchWorkspace(next: string) {
    void navigation.pushPreservingOrigin({
        path: `/main/management/workspace/${next}`,
        query: {
            view: route.query.view,
            organization: workspace.workspaces.find((item) => item.id === next)?.organizationId,
        },
    });
}
async function save() {
    if (!data.value) return;
    const current = selection.value,
        patch = { name: name.value, description: description.value, expectedUpdatedAt: data.value.workspace.updatedAt };
    saved.value = await write((signal) => source.updateWorkspace(current, patch, signal));
}
</script>
<template>
    <DetailPage
        :id="id"
        v-model="view"
        :title="data?.workspace.name ?? '工作区详情'"
        :icon="Folders"
        :subtitle="data?.organization.name"
        :status="data ? (data.workspace.archivedAt ? '已归档' : '可用') : undefined"
        list-label="工作区"
        list-path="/main/management/workspace"
        :views="views"
        :options="workspace.workspaces.filter((item) => item.organizationId === organizationId)"
        :loading="loading"
        :error="error || (!organizationId ? '工作区不存在或当前账户无权访问，请从工作区列表重新进入。' : '')"
        @retry="refresh"
        @select="switchWorkspace"
    >
        <template v-if="data" #actions>
            <Button v-if="data.canViewMembers" variant="outline" @click="view = 'member'">
                <Users />
                成员管理
            </Button>
            <Button v-if="data.canUpdate" variant="outline" @click="view = 'setting'">
                <Pencil />
                编辑资料
            </Button>
        </template>
        <template v-if="data">
            <DataSyncNotice
                scope="工作区"
                :error="syncError"
                :pending="pendingSync"
                :busy="busy || loading"
                @retry="refresh"
            />
            <template v-if="view === 'overview'">
                <div class="grid min-w-0 gap-6 @min-[1000px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                    <ManagementSection title="基本信息">
                        <FactList
                            :fields="[
                                { label: '工作区', value: data.workspace.name },
                                { label: '所属组织', value: data.organization.name },
                                { label: '创建时间', value: detailDate(data.workspace.createdAt) },
                                { label: '更新时间', value: detailDate(data.workspace.updatedAt) },
                                { label: '说明', value: data.workspace.description || '—' },
                            ]"
                        />
                    </ManagementSection>
                    <ManagementSection title="资源概况">
                        <div class="grid grid-cols-2 gap-4">
                            <Button
                                v-for="kind in resourceKinds"
                                :key="kind.kind"
                                variant="ghost"
                                class="h-auto justify-start gap-3 p-2"
                                @click="view = 'resource'"
                            >
                                <component :is="kind.icon" class="size-5 shrink-0 text-primary" />
                                <span class="text-left">
                                    <span class="block text-sm text-muted-foreground">{{ kind.label }}</span>
                                    <span class="text-xl font-semibold">
                                        {{
                                            kind.kind === 'material'
                                                ? (resources.data.value?.total ??
                                                  (resources.loading.value ? '加载中' : '不可用'))
                                                : '未接入'
                                        }}
                                    </span>
                                </span>
                            </Button>
                        </div>
                    </ManagementSection>
                    <ManagementSection title="成员概况">
                        <template #actions>
                            <Button variant="ghost" size="sm" class="h-auto p-0" @click="view = 'member'">
                                {{ data.memberTotal === null ? '无权查看' : `${data.memberTotal} 人` }}
                            </Button>
                        </template>
                        <div class="grid grid-cols-3 gap-4">
                            <button
                                v-for="member in data.members.slice(0, 6)"
                                :key="member.id"
                                class="group flex min-w-0 flex-col items-center gap-2 text-sm"
                                @click="openMember(member.id)"
                            >
                                <Avatar class="size-10">
                                    <AvatarFallback>{{ member.name.slice(0, 1) }}</AvatarFallback>
                                </Avatar>
                                <span class="max-w-full truncate group-hover:underline group-focus-visible:underline">
                                    {{ member.name }}
                                </span>
                                <span class="text-xs text-muted-foreground">
                                    {{ member.isOwner ? '组织所有者' : '成员' }}
                                </span>
                            </button>
                        </div>
                    </ManagementSection>
                </div>
                <div class="grid min-w-0 gap-6 @min-[1000px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <ManagementSection title="最近活动">
                        <ActivityFeed v-if="data.canReadActivity" :activity="activity" />
                        <p v-else class="text-sm text-muted-foreground">当前账户无权查看管理活动</p>
                    </ManagementSection>
                    <ManagementSection title="新增资源记录">
                        <figure v-if="resources.data.value" class="space-y-3">
                            <figcaption class="text-xs text-muted-foreground">
                                材料每周新增 · UTC · {{ resources.data.value.creations.from.slice(0, 10) }} 至
                                {{ resources.data.value.creations.to.slice(0, 10) }}
                            </figcaption>
                            <div class="grid h-40 grid-cols-4 gap-5" role="img" aria-label="最近四周材料新增数量">
                                <div
                                    v-for="point in resources.data.value.creations.points"
                                    :key="point.from"
                                    class="flex min-h-0 flex-col text-center"
                                >
                                    <div class="flex min-h-0 flex-1 items-end border-b">
                                        <div
                                            class="w-full rounded-t-sm bg-chart-1"
                                            :style="{
                                                height: `${(point.count / Math.max(1, ...resources.data.value.creations.points.map((item) => item.count))) * 100}%`,
                                            }"
                                        />
                                    </div>
                                    <span class="pt-2 text-sm font-medium">{{ point.count }}</span>
                                    <span class="text-xs text-muted-foreground">{{ point.from.slice(5, 10) }}</span>
                                </div>
                            </div>
                        </figure>
                        <p v-else-if="resources.loading.value" role="status" class="text-sm text-muted-foreground">
                            正在加载材料新增记录
                        </p>
                        <div v-else class="text-sm text-muted-foreground">
                            {{ resources.error.value || '材料新增记录暂不可用' }}
                            <Button variant="link" @click="resources.refresh">重新加载</Button>
                        </div>
                        <Button variant="link" class="mt-4 px-0" @click="view = 'sharing'">查看设施访问关系</Button>
                    </ManagementSection>
                </div>
            </template>
            <TeamManagement
                v-else-if="(view === 'member' || view === 'role') && data.canViewMembers"
                :key="`${id}:${view}`"
                :view="view === 'member' ? 'members' : 'roles'"
                :context="teamContext"
            />
            <p v-else-if="view === 'member' || view === 'role'" class="text-sm text-muted-foreground">
                当前账户无权查看成员与角色管理数据
            </p>
            <WorkspaceResource v-else-if="view === 'resource'" :key="key" :scope="selection" />
            <ManagementSection v-else-if="view === 'sharing'" title="设施访问">
                <FacilityAccess :scope="selection" />
            </ManagementSection>
            <div
                v-else-if="view === 'setting'"
                class="grid min-w-0 gap-8 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            >
                <ManagementSection title="基本资料">
                    <form class="max-w-[720px] space-y-5" @submit.prevent="save">
                        <Field>
                            <FieldLabel :for="formFieldId + '-1'">名称</FieldLabel>
                            <Input
                                :id="formFieldId + '-1'"
                                v-model="name"
                                required
                                maxlength="40"
                                :disabled="!data.canUpdate || busy"
                            />
                        </Field>
                        <Field>
                            <FieldLabel :for="formFieldId + '-2'">说明</FieldLabel>
                            <Textarea
                                :id="formFieldId + '-2'"
                                v-model="description"
                                maxlength="500"
                                rows="5"
                                :disabled="!data.canUpdate || busy"
                            />
                            <FieldDescription class="text-right text-xs text-muted-foreground">
                                {{ description.length }} / 500
                            </FieldDescription>
                        </Field>
                        <p v-if="saved && !dirty" role="status" class="text-sm text-success-foreground">更改已保存</p>
                        <div class="flex gap-2">
                            <Button :disabled="!data.canUpdate || !dirty || busy || pendingSync">
                                {{ busy ? '保存中' : '保存更改' }}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                :disabled="!dirty || busy"
                                @click="
                                    name = data.workspace.name;
                                    description = data.workspace.description;
                                "
                            >
                                取消
                            </Button>
                        </div>
                    </form>
                </ManagementSection>
                <ManagementSection title="工作区事实">
                    <FactList
                        :fields="[
                            { label: '所属组织', value: data.organization.name },
                            { label: '创建时间', value: detailDate(data.workspace.createdAt) },
                            { label: '更新时间', value: detailDate(data.workspace.updatedAt) },
                            { label: '成员数', value: data.memberTotal ?? '无权查看' },
                        ]"
                    />
                </ManagementSection>
            </div>
        </template>
    </DetailPage>
    <DraftDialog :open="guard.open.value" @decide="guard.decide" />
</template>
