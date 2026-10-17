<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ShieldCheck, Eye } from '@lucide/vue';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
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
import { usePrototypeObject, detailDate, type RoleDetail } from '../detail/prototype';
import PermissionMatrix from './PermissionMatrix.vue';

const route = useRoute(),
    router = useRouter(),
    navigation = useNavigationStore();
const id = computed(() => String(route.params.roleId ?? ''));
const organizationId = computed(() => (typeof route.query.organization === 'string' ? route.query.organization : ''));
const key = computed(() => `${organizationId.value}:${id.value}`);
const { data, catalog, loading, busy, error, syncError, refresh, write } = usePrototypeObject(key, (source, signal) =>
    source.role(organizationId.value, id.value, signal)
);
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
type Binding = RoleDetail['bindings'][number];
const columns: DataTableColumn<Binding>[] = [
    { id: 'name', label: '成员', size: 220, fill: true, value: (row) => row.member.name },
    { id: 'email', label: '邮箱', size: 260, value: (row) => row.member.email },
    {
        id: 'scope',
        label: '绑定范围',
        size: 240,
        value: (row) => row.workspace?.name ?? data.value?.organization.name ?? '—',
    },
    { id: 'joined', label: '成员加入时间', size: 200, value: (row) => detailDate(row.joinedAt) },
];
function openMember(binding: Binding) {
    void router.push({
        path: `/main/management/member/${binding.member.id}`,
        query: { organization: organizationId.value },
    });
}
function switchRole(next: string) {
    void router.push({
        path: `/main/management/role/${next}`,
        query: { ...route.query, organization: organizationId.value },
        state: { navigationOrigin: navigation.origin ? { ...navigation.origin } : null },
    });
}
async function save() {
    const roleId = id.value,
        selection = { organizationId: organizationId.value },
        role = { name: name.value.trim(), permissions: [...permissions.value] };
    saved.value = await write((source, signal) =>
        source.team.mutate(selection, { kind: 'update-role', id: roleId, role }, signal)
    );
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
        :options="catalog?.roles.filter((item) => item.organizationId === organizationId && !item.archivedAt) ?? []"
        :loading="loading"
        :error="error"
        @retry="refresh"
        @select="switchRole"
    >
        <template v-if="data" #actions>
            <Badge variant="secondary">{{ data.bindings.length }} 项绑定</Badge>
        </template>
        <template v-if="data">
            <DataSyncNotice scope="模拟角色" :error="syncError" :busy="busy || loading" @retry="refresh" />
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
                        :disabled="!data.canEdit || busy || !!syncError"
                    />
                </ManagementSection>
                <FactList
                    :fields="[
                        { label: '创建时间', value: detailDate(data.role.createdAt) },
                        { label: '更新时间', value: detailDate(data.role.updatedAt) },
                    ]"
                />
                <p v-if="saved && !dirty" role="status" class="text-sm text-success-foreground">模拟角色定义已保存</p>
                <div v-if="data.canEdit" class="flex gap-2">
                    <Button :disabled="!dirty || busy || !!syncError">{{ busy ? '保存中' : '保存模拟更改' }}</Button>
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
                v-else-if="view === 'member'"
                :data="
                    data.bindings.map((item) => ({
                        ...item,
                        id: `${item.member.id}:${item.workspace?.id ?? 'organization'}`,
                    }))
                "
                :columns="columns"
                :actions="[{ id: 'detail', label: '详情', icon: Eye, primary: true, run: openMember }]"
                search-label="搜索关联成员"
                empty-text="此角色没有有效成员绑定"
            />
            <ManagementSection v-else-if="view === 'activity'" title="角色变更记录">
                <ActivityList :items="data.activities" />
            </ManagementSection>
        </template>
    </DetailPage>
    <DraftDialog :open="guard.open.value" @decide="guard.decide" />
</template>
