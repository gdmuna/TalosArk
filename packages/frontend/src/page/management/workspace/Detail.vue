<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Folders, Users, Pencil, FlaskConical, Package, Monitor, Building2 } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Avatar, AvatarFallback } from '@/ui/avatar';
import { DataSyncNotice } from '@/component/data-sync';
import { TeamManagement } from '@/module/workspace/ui';
import { useNavigationStore } from '@/platform/navigation';
import DetailPage from '../detail/DetailPage.vue';
import FactList from '../detail/FactList.vue';
import ActivityList from '../detail/ActivityList.vue';
import DraftDialog from '../detail/DraftDialog.vue';
import { useDraftGuard } from '../detail/useDraftGuard';
import ManagementSection from '../component/ManagementSection.vue';
import { useManagementView } from '../useManagementView';
import { usePrototypeObject, usePrototypeTeam, detailDate } from '../detail/prototype';
import WorkspaceResource from './Resource.vue';
import WorkspaceSharing from './Sharing.vue';

const route = useRoute(),
    router = useRouter(),
    navigation = useNavigationStore();
const id = computed(() => String(route.params.workspaceId ?? ''));
const { source, data, catalog, loading, busy, error, syncError, refresh, write } = usePrototypeObject(
    id,
    (source, signal) => source.workspace(id.value, signal)
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
const { model, contextCatalog } = usePrototypeTeam(catalog, source);
const teamContext = computed(() => ({
    team: model,
    catalog: contextCatalog,
    selection: { organizationId: data.value?.organization.id ?? '', workspaceId: id.value },
    simulation: true as const,
    roleBindings: data.value?.roleBindings ?? {},
    onMemberDetail: (memberId: string) => {
        const membership = data.value?.memberships.find((item) => item.id === memberId);
        if (membership)
            void router.push({
                path: `/main/management/member/${membership.organizationMemberId}`,
                query: { organization: membership.organizationId },
            });
    },
    onRoleDetail: (roleId: string) => {
        void router.push({
            path: `/main/management/role/${roleId}`,
            query: { organization: data.value?.organization.id },
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
        query: { organization: data.value?.organization.id },
    });
}
function switchWorkspace(next: string) {
    void router.push({
        path: `/main/management/workspace/${next}`,
        query: { view: route.query.view },
        state: { navigationOrigin: navigation.origin ? { ...navigation.origin } : null },
    });
}
async function save() {
    const currentId = id.value,
        patch = { name: name.value, description: description.value };
    saved.value = await write((source, signal) => source.updateWorkspace(currentId, patch, signal));
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
        :options="catalog?.workspaces.filter((item) => item.organizationId === data?.organization.id) ?? []"
        :loading="loading"
        :error="error"
        @retry="refresh"
        @select="switchWorkspace"
    >
        <template v-if="data" #actions>
            <Button variant="outline" @click="view = 'member'">
                <Users />
                成员管理
            </Button>
            <Button v-if="data.canUpdate" variant="outline" @click="view = 'setting'">
                <Pencil />
                编辑资料
            </Button>
        </template>
        <template v-if="data">
            <DataSyncNotice scope="模拟工作区" :error="syncError" :busy="busy || loading" @retry="refresh" />
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
                                        {{ data.resources.filter((item) => item.kind === kind.kind).length }}
                                    </span>
                                </span>
                            </Button>
                        </div>
                    </ManagementSection>
                    <ManagementSection title="成员概况">
                        <template #actions>
                            <Button variant="ghost" size="sm" class="h-auto p-0" @click="view = 'member'">
                                {{ data.members.length }} 人
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
                    <ManagementSection title="最近活动"><ActivityList :items="data.activities" /></ManagementSection>
                    <ManagementSection title="新增资源记录">
                        <figure class="space-y-3">
                            <figcaption class="text-xs text-muted-foreground">
                                {{ data.resourceCreations.from }} 至 {{ data.resourceCreations.to }} · 每周新增数量
                            </figcaption>
                            <div
                                class="grid h-40 grid-cols-4 gap-5"
                                role="img"
                                :aria-label="
                                    data.resourceCreations.points
                                        .map((point) => `${point.label} 起一周新增 ${point.count} 项`)
                                        .join('；')
                                "
                            >
                                <div
                                    v-for="point in data.resourceCreations.points"
                                    :key="point.label"
                                    class="flex min-h-0 flex-col text-center"
                                >
                                    <div class="flex min-h-0 flex-1 items-end border-b">
                                        <div
                                            class="w-full rounded-t-sm bg-chart-1"
                                            :style="{
                                                height: `${(point.count / Math.max(1, ...data.resourceCreations.points.map((item) => item.count))) * 100}%`,
                                            }"
                                        />
                                    </div>
                                    <span class="pt-2 text-sm font-medium">{{ point.count }}</span>
                                    <span class="text-xs text-muted-foreground">{{ point.label }}</span>
                                </div>
                            </div>
                        </figure>
                        <Button variant="link" class="mt-4 px-0" @click="view = 'sharing'">
                            设施访问 · 发出 {{ data.outgoingAccess.length }} / 收到 {{ data.incomingAccess.length }}
                        </Button>
                    </ManagementSection>
                </div>
            </template>
            <TeamManagement
                v-else-if="view === 'member' || view === 'role'"
                :key="`${id}:${view}`"
                :view="view === 'member' ? 'members' : 'roles'"
                :context="teamContext"
            />
            <WorkspaceResource v-else-if="view === 'resource'" :key="id" :items="data.resources" />
            <WorkspaceSharing
                v-else-if="view === 'sharing'"
                :outgoing="data.outgoingAccess"
                :incoming="data.incomingAccess"
                :workspaces="catalog?.workspaces ?? []"
            />
            <div
                v-else-if="view === 'setting'"
                class="grid min-w-0 gap-8 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            >
                <ManagementSection title="基本资料">
                    <form class="max-w-[720px] space-y-5" @submit.prevent="save">
                        <label class="grid gap-2 text-sm">
                            名称
                            <Input v-model="name" required maxlength="40" :disabled="!data.canUpdate || busy" />
                        </label>
                        <label class="grid gap-2 text-sm">
                            说明
                            <Textarea
                                v-model="description"
                                maxlength="500"
                                rows="5"
                                :disabled="!data.canUpdate || busy"
                            />
                            <span class="text-right text-xs text-muted-foreground">{{ description.length }} / 500</span>
                        </label>
                        <p v-if="saved && !dirty" role="status" class="text-sm text-success-foreground">
                            模拟更改已保存
                        </p>
                        <div class="flex gap-2">
                            <Button :disabled="!data.canUpdate || !dirty || busy || !!syncError">
                                {{ busy ? '保存中' : '保存模拟更改' }}
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
                            { label: '成员数', value: data.members.length },
                        ]"
                    />
                </ManagementSection>
            </div>
        </template>
    </DetailPage>
    <DraftDialog :open="guard.open.value" @decide="guard.decide" />
</template>
