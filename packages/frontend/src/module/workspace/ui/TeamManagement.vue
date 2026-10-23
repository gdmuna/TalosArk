<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue';
import { useRouter } from 'vue-router';
import {
    Plus,
    UserPlus,
    UserMinus,
    ShieldCheck,
    Pencil,
    Archive,
    Send,
    X,
    RotateCw,
    ChevronLeft,
    ChevronRight,
    LogOut,
    List,
    Grid2X2,
} from '@lucide/vue';
import type { TeamMember, TeamRole, TeamRoleBody, TeamInvitation } from '@talos-ark/contracts/team';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/checkbox';
import { Avatar, AvatarFallback } from '@/ui/avatar';
import { Badge } from '@/ui/badge';
import { StateBadge } from '@/component/state-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog';
import { SelectField } from '@/component/select-field';
import { ButtonGroup } from '@/ui/button-group';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import { DataSyncNotice } from '@/component/data-sync';
import { useWorkspaceStore } from '../model/store';
import { useTeamStore } from '../model/team-store';
import type { TeamCommand } from '../data/team-source';
import TeamActionMenu from './TeamActionMenu.vue';
import TeamPermissionField from './TeamPermissionField.vue';
import TeamPermissionMatrix from './TeamPermissionMatrix.vue';
import type { TeamManagementContext } from './team-context';
import type { TeamManagementListState } from './team-list-state';
import { Field, FieldError, FieldLabel } from '@/ui/field';
import { OverlayDraftDialog, useOverlayDraft } from '@/component/overlay-draft';
const standaloneFieldId = useId();

const formFieldId = useId();

const props = defineProps<{
    view: 'members' | 'roles';
    context?: TeamManagementContext;
    listState?: TeamManagementListState;
}>();
const emit = defineEmits<{
    'scope-label': [label: string];
    'update:list-state': [state: TeamManagementListState];
}>();
const router = useRouter();
function openMemberDetail(member: TeamMember) {
    if (props.context) return props.context.onMemberDetail(member.id);
    void router.push({
        path: `/main/management/member/${member.organizationMemberId}`,
        query: { organization: organizationId.value, workspace: selectedWorkspaceId.value },
    });
}
function openRoleDetail(role: TeamRole) {
    if (props.context) return props.context.onRoleDetail(role.id);
    void router.push({
        path: `/main/management/role/${role.id}`,
        query: {
            organization: organizationId.value,
            workspace: role.scope === 'WORKSPACE' ? selectedWorkspaceId.value : undefined,
        },
    });
}
const workspace = props.context?.catalog ?? useWorkspaceStore(),
    team = props.context?.team ?? useTeamStore();
const localState = ref<TeamManagementListState>({
    organizationId:
        props.context?.selection.organizationId ?? workspace.organization?.id ?? workspace.organizations[0]?.id ?? '',
    workspaceId: props.context?.selection.workspaceId,
    tab: 'members',
    search: '',
    page: 1,
    pageSize: 20,
    roleFilter: props.context?.selection.workspaceId ? 'WORKSPACE' : 'all',
    roleView: 'list',
});
const listState = computed(() => (props.context ? localState.value : (props.listState ?? localState.value)));
function updateList(patch: Partial<TeamManagementListState>) {
    const next = { ...listState.value, ...patch };
    if (props.listState && !props.context) emit('update:list-state', next);
    else localState.value = next;
}
const organizationId = computed({
    get: () => listState.value.organizationId,
    set: (value) => updateList({ organizationId: value, workspaceId: undefined, search: '', page: 1 }),
});
const workspaceId = computed({
    get: () => listState.value.workspaceId ?? 'organization',
    set: (value) => updateList({ workspaceId: value === 'organization' ? undefined : value, search: '', page: 1 }),
});
const selectedWorkspaceId = computed(() => (workspaceId.value === 'organization' ? undefined : workspaceId.value));
const tab = computed({
    get: () => listState.value.tab,
    set: (value) => updateList({ tab: value, page: 1 }),
});
const search = ref(listState.value.search);
const roleSearch = computed({
    get: () => listState.value.search,
    set: (value) => updateList({ search: value }),
});
const roleFilter = computed({
    get: () => listState.value.roleFilter,
    set: (value) => updateList({ roleFilter: value }),
});
const roleView = computed({
    get: () => listState.value.roleView,
    set: (value) => updateList({ roleView: value }),
});
watch(
    () => listState.value.search,
    (value) => (search.value = value)
);
const preview = ref<{ kind: 'member' | 'role' | 'invitation'; id: string } | null>(null);
const modal = ref<'invite' | 'add-member' | 'bindings' | 'role' | 'confirm' | null>(null);
const email = ref(''),
    formError = ref('');
const selectedMember = ref<TeamMember | null>(null),
    selectedRole = ref<TeamRole | null>(null);
const roleName = ref(''),
    roleCode = ref(''),
    roleScope = ref<'ORGANIZATION' | 'WORKSPACE'>('WORKSPACE');
const permissions = ref<string[]>([]),
    roleIds = ref<string[]>([]);
const confirmation = ref<TeamCommand | null>(null),
    confirmationTitle = ref('');
const modalOpen = computed({
    get: () => modal.value !== null,
    set: (value) => {
        if (!value) modal.value = null;
    },
});
const { guardedOpen, confirmOpen, discard } = useOverlayDraft(
    modalOpen,
    () =>
        JSON.stringify([
            email.value,
            roleName.value,
            roleCode.value,
            roleScope.value,
            permissions.value,
            roleIds.value,
        ]),
    { busy: () => team.busy, saved: () => team.syncPending }
);
let generation = 0;
watch(modal, () => {
    generation++;
    formError.value = '';
});
const organizationOptions = computed(() =>
    workspace.organizations.map((item) => ({ value: item.id, label: item.name }))
);
const scopeOptions = computed(() => [
    { value: 'organization', label: '组织' },
    ...workspace.workspaces
        .filter((item) => item.organizationId === organizationId.value)
        .map((item) => ({ value: item.id, label: item.name })),
]);
const disabled = computed(() => team.busy || team.loading || team.syncPending);
const definitions = computed(() => team.data?.definitions.filter((item) => item.scope === roleScope.value) ?? []);
const scopeName = computed(() => scopeOptions.value.find((item) => item.value === workspaceId.value)?.label ?? '组织');
const organizationName = computed(
    () => organizationOptions.value.find((item) => item.value === organizationId.value)?.label ?? '组织'
);
watch(
    [organizationName, scopeName],
    () => emit('scope-label', `${organizationName.value} · ${props.view === 'roles' ? '角色定义' : scopeName.value}`),
    { immediate: true }
);
const filteredRoles = computed(() =>
    (team.data?.roles ?? []).filter(
        (role) =>
            (roleFilter.value === 'all' || role.scope === roleFilter.value) &&
            `${role.name} ${role.code}`.toLocaleLowerCase().includes(roleSearch.value.trim().toLocaleLowerCase())
    )
);
const matrixDefinitions = computed(() =>
    (team.data?.definitions ?? []).filter((item) => roleFilter.value === 'all' || item.scope === roleFilter.value)
);
const permissionName = (code: string) => team.data?.definitions.find((item) => item.code === code)?.name ?? code;
const previewRecord = computed(() => {
    const current = preview.value;
    if (!current) return;
    if (current.kind === 'member') {
        const member = team.data?.members.find((item) => item.id === current.id);
        if (member)
            return {
                id: member.id,
                name: member.name,
                kind: '成员身份',
                fields: [
                    { label: '邮箱', value: member.email },
                    { label: '状态', value: status(member.status) },
                    { label: '角色', value: member.roles.map((role) => role.name).join('、') || '—' },
                    { label: '所有者', value: member.isOwner ? '是' : '否' },
                ],
            };
    } else if (current.kind === 'role') {
        const role = team.data?.roles.find((item) => item.id === current.id);
        if (role)
            return {
                id: role.id,
                name: role.name,
                kind: '角色定义',
                fields: [
                    { label: '标识', value: role.code },
                    { label: '作用域', value: role.scope === 'ORGANIZATION' ? '组织' : '工作区' },
                    { label: '保护状态', value: role.protected ? '系统保护' : '可管理' },
                    { label: '权限', value: role.permissions.map(permissionName).join('\n') || '—' },
                ],
            };
    } else {
        const invitation = team.data?.invitations.find((item) => item.id === current.id);
        if (invitation)
            return {
                id: invitation.id,
                name: invitation.email,
                kind: '成员邀请',
                fields: [
                    { label: '邀请范围', value: invitation.workspaceName || '组织' },
                    { label: '状态', value: status(invitation.status) },
                    { label: '有效期', value: new Date(invitation.expiresAt).toLocaleString() },
                ],
            };
    }
});
const previewOpen = computed({
    get: () => !!previewRecord.value,
    set: (value) => {
        if (!value) preview.value = null;
    },
});
const total = computed(() =>
    props.view === 'roles'
        ? (team.data?.roles.filter((role) => !props.context?.selection.workspaceId || role.scope === 'WORKSPACE')
              .length ?? 0)
        : tab.value === 'members'
          ? (team.data?.memberTotal ?? 0)
          : (team.data?.invitationTotal ?? 0)
);
const pages = computed(() => Math.max(1, Math.ceil(total.value / (team.data?.pageSize ?? team.pageSize))));
const pageSize = computed({
    get: () => String(team.data?.pageSize ?? team.pageSize),
    set: (value) => {
        updateList({ search: team.appliedSearch, pageSize: Number(value), page: 1 });
    },
});
const confirmationDescription = computed(() => {
    switch (confirmation.value?.kind) {
        case 'leave':
            return selectedWorkspaceId.value
                ? '将离开此工作区，不影响其他工作区的成员身份。'
                : '将离开此组织及其工作区，不会注销账户。';
        case 'remove-member':
            return selectedWorkspaceId.value
                ? '将移除此工作区的成员身份，不会删除账户。'
                : '将移除此组织及其工作区的成员身份，不会删除账户。';
        case 'archive-role':
            return '角色归档后不能再分配；已有绑定的角色由服务端拒绝归档。';
        case 'revoke':
            return '撤销后，收件人无法再使用原邀请链接加入。';
        default:
            return '';
    }
});
const status = (value: string) =>
    (
        ({
            ACTIVE: '有效',
            LEFT: '已离开',
            SUSPENDED: '已暂停',
            pending: '待接受',
            accepted: '已接受',
            revoked: '已撤销',
            expired: '已过期',
        }) as Record<string, string>
    )[value] ?? value;

watch(
    () => workspace.organizations,
    (organizations) => {
        if (!organizations.some((item) => item.id === organizationId.value))
            organizationId.value = organizations[0]?.id ?? '';
    }
);
watch(
    [
        organizationId,
        workspaceId,
        () => workspace.activeId,
        () => (props.view === 'members' ? listState.value.page : 1),
        () => (props.view === 'members' ? listState.value.pageSize : 20),
        () => (props.view === 'members' ? listState.value.search : ''),
    ],
    async (values, previous) => {
        const scopeChanged = !previous.length || values.slice(0, 3).some((value, index) => value !== previous[index]);
        if (scopeChanged) {
            modal.value = null;
            preview.value = null;
        }
        if (!organizationId.value) {
            team.reset();
            return;
        }
        if (!scopeOptions.value.some((item) => item.value === workspaceId.value)) {
            workspaceId.value = 'organization';
            return;
        }
        const query = {
            page: props.view === 'members' ? listState.value.page : 1,
            pageSize: props.view === 'members' ? listState.value.pageSize : 20,
            search: props.view === 'members' ? listState.value.search : '',
        };
        if (scopeChanged) {
            await team.select({ organizationId: organizationId.value, workspaceId: selectedWorkspaceId.value }, query);
        } else {
            team.page = query.page;
            team.pageSize = query.pageSize;
            team.search = query.search;
            await reload();
        }
    },
    { immediate: true }
);
watch(tab, () => {
    preview.value = null;
});
watch(
    () => team.data,
    (data) => {
        if (!previewRecord.value) preview.value = null;
        if (!data) {
            modal.value = null;
            return;
        }
        if (!data.canInvite && tab.value === 'invitations') tab.value = 'members';
        if (
            (modal.value === 'role' &&
                (!data.canManageRoles ||
                    (selectedRole.value &&
                        !data.roles.some((item) => item.id === selectedRole.value?.id && item.canEdit)))) ||
            (modal.value === 'bindings' &&
                (!data.canManageMembers ||
                    !data.members.some((item) => item.id === selectedMember.value?.id && item.canManageRoles))) ||
            (modal.value === 'invite' && !data.canInvite)
        )
            modal.value = null;
        if (!data.definitions.length) roleView.value = 'list';
        if (props.view === 'members' && data.page > pages.value) {
            updateList({ page: pages.value });
        }
    }
);
async function reload() {
    try {
        await team.load();
    } catch {
        /* Error and retry stay visible. */
    }
}
function goToPage(page: number) {
    if (team.busy || team.loading) return;
    updateList({ page, pageSize: team.data?.pageSize ?? team.pageSize, search: team.appliedSearch });
    search.value = team.appliedSearch;
}
function searchMembers() {
    if (team.busy || team.loading) return;
    if (listState.value.search === search.value.trim() && listState.value.page === 1) return void reload();
    updateList({ search: search.value.trim(), page: 1, pageSize: team.data?.pageSize ?? team.pageSize });
}
function toggle(values: string[], value: string, checked: boolean | 'indeterminate') {
    return checked === true ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}
function openEmail(kind: 'invite' | 'add-member') {
    email.value = '';
    modal.value = kind;
}
function editBindings(member: TeamMember) {
    selectedMember.value = member;
    roleIds.value = member.roles.map((role) => role.id);
    modal.value = 'bindings';
}
function editRole(role?: TeamRole) {
    selectedRole.value = role ?? null;
    roleName.value = role?.name ?? '';
    roleCode.value = role?.code ?? '';
    roleScope.value = role?.scope ?? 'WORKSPACE';
    permissions.value = [...(role?.permissions ?? [])];
    modal.value = 'role';
}
function memberActions(member: TeamMember) {
    if (!team.data?.canManageMembers) return [];
    return [
        ...(member.canManageRoles ? [{ label: '分配角色', icon: ShieldCheck, run: () => editBindings(member) }] : []),
        ...(member.canRemove
            ? [
                  {
                      label: selectedWorkspaceId.value ? '移出工作区' : '移出组织',
                      icon: UserMinus,
                      destructive: true,
                      run: () =>
                          confirm(`移出${scopeName.value}中的成员「${member.name}」？`, {
                              kind: 'remove-member',
                              id: member.id,
                          }),
                  },
              ]
            : []),
    ];
}
function roleActions(role: TeamRole) {
    if (!team.data?.canManageRoles || !role.canEdit) return [];
    return [
        { label: '编辑角色', icon: Pencil, run: () => editRole(role) },
        {
            label: '归档角色',
            icon: Archive,
            destructive: true,
            run: () => confirm(`归档角色「${role.name}」？`, { kind: 'archive-role', id: role.id }),
        },
    ];
}
function invitationActions(invitation: TeamInvitation) {
    if (!team.data?.canInvite || !['pending', 'expired'].includes(invitation.status)) return [];
    return [
        {
            label: '重发邀请',
            icon: Send,
            run: () => {
                void team.mutate({ kind: 'resend', id: invitation.id });
            },
        },
        {
            label: '撤销邀请',
            icon: X,
            destructive: true,
            run: () => confirm(`撤销发送给「${invitation.email}」的邀请？`, { kind: 'revoke', id: invitation.id }),
        },
    ];
}
function confirm(title: string, command: TeamCommand) {
    confirmationTitle.value = title;
    confirmation.value = command;
    modal.value = 'confirm';
}
async function submit() {
    const current = generation;
    let command: TeamCommand | undefined;
    if (modal.value === 'invite' || modal.value === 'add-member')
        command = { kind: modal.value, email: email.value.trim() };
    else if (modal.value === 'bindings' && selectedMember.value)
        command = { kind: 'bind', id: selectedMember.value.id, roleIds: [...roleIds.value] };
    else if (modal.value === 'confirm') command = confirmation.value ?? undefined;
    else if (modal.value === 'role') {
        const body: TeamRoleBody = {
            name: roleName.value.trim(),
            code: roleCode.value.trim(),
            scope: roleScope.value,
            permissions: [...permissions.value],
        };
        command = selectedRole.value
            ? {
                  kind: 'update-role',
                  id: selectedRole.value.id,
                  role: {
                      name: body.name,
                      permissions: body.permissions,
                      expectedUpdatedAt: selectedRole.value.updatedAt,
                  },
              }
            : { kind: 'create-role', role: body };
    }
    if (!command) return;
    const success = await team.mutate(command);
    if (current !== generation) return;
    if (success) modal.value = null;
    else if (success !== null) formError.value = team.error || '当前状态尚未同步，请重新检查';
}
</script>

<template>
    <section class="@container/team-management min-w-0 space-y-4">
        <div class="flex flex-wrap items-center gap-3">
            <SelectField
                v-if="!context"
                v-model="organizationId"
                label="组织"
                :options="organizationOptions"
                :disabled="team.busy"
            />
            <SelectField
                v-if="view === 'members' && !context"
                v-model="workspaceId"
                label="成员范围"
                :options="scopeOptions"
                :disabled="team.busy"
            />
            <Button
                variant="outline"
                size="icon"
                use-tooltip
                aria-label="重新加载"
                :disabled="team.busy || team.loading"
                @click="reload"
            >
                <RotateCw />
            </Button>
            <div class="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
                <Button
                    v-if="team.data?.canInitialize"
                    :disabled="disabled"
                    @click="team.mutate({ kind: 'initialize' })"
                >
                    <ShieldCheck />
                    启用团队管理
                </Button>
                <Button
                    v-if="view === 'members' && selectedWorkspaceId && team.data?.canManageMembers"
                    variant="outline"
                    :disabled="disabled"
                    @click="openEmail('add-member')"
                >
                    <Plus />
                    添加组织成员
                </Button>
                <Button
                    v-if="view === 'members' && team.data?.canInvite"
                    :disabled="disabled"
                    @click="openEmail('invite')"
                >
                    <UserPlus />
                    邀请成员
                </Button>
                <Button v-if="view === 'roles' && team.data?.canManageRoles" :disabled="disabled" @click="editRole()">
                    <Plus />
                    新建角色
                </Button>
                <Button
                    v-if="view === 'members' && team.data && !team.data.isOwner"
                    variant="outline"
                    :disabled="disabled"
                    @click="confirm(selectedWorkspaceId ? '离开此工作区？' : '离开此组织？', { kind: 'leave' })"
                >
                    <LogOut />
                    离开
                </Button>
            </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{{ organizationName }}</span>
            <span aria-hidden="true">/</span>
            <span>{{ view === 'roles' ? '角色定义' : scopeName }}</span>
            <span v-if="team.loading" role="status" class="ml-auto">{{ team.data ? '正在更新列表' : '正在加载' }}</span>
        </div>
        <p v-if="team.error && !team.syncError" role="alert" class="text-sm text-destructive">
            {{ team.error }}
            <span v-if="team.data" class="ml-2 text-muted-foreground">当前显示上次成功加载的结果</span>
        </p>
        <DataSyncNotice
            scope="团队管理"
            :error="team.syncError"
            :pending="team.syncPending"
            :busy="team.loading || team.busy"
            @retry="reload"
        />
        <p v-if="team.notice" role="status" class="text-sm text-muted-foreground">
            {{ context?.simulation ? '模拟操作已完成，未发送邮件' : team.notice }}
        </p>
        <p v-if="!organizationId" class="py-10 text-center text-sm text-muted-foreground">暂无可用组织</p>
        <template v-else-if="team.data">
            <div v-if="view === 'members'" class="flex flex-wrap items-center gap-3">
                <div class="flex rounded-md border p-0.5" aria-label="成员视图">
                    <Button :variant="tab === 'members' ? 'secondary' : 'ghost'" size="sm" @click="tab = 'members'">
                        成员 {{ team.data.memberTotal }}
                    </Button>
                    <Button
                        v-if="team.data.canInvite"
                        :variant="tab === 'invitations' ? 'secondary' : 'ghost'"
                        size="sm"
                        @click="tab = 'invitations'"
                    >
                        邀请 {{ team.data.invitationTotal }}
                    </Button>
                </div>
                <form
                    class="flex w-full gap-2 @min-[600px]/team-management:ml-auto @min-[600px]/team-management:w-auto"
                    @submit.prevent="searchMembers"
                >
                    <Field class="min-w-0 flex-1 @min-[600px]/team-management:w-60">
                        <FieldLabel :for="formFieldId + '-search'" class="sr-only">
                            {{ tab === 'members' ? '搜索姓名或邮箱' : '搜索邀请邮箱' }}
                        </FieldLabel>
                        <Input
                            :id="formFieldId + '-search'"
                            v-model="search"
                            :aria-label="tab === 'members' ? '搜索姓名或邮箱' : '搜索邀请邮箱'"
                            :placeholder="tab === 'members' ? '搜索姓名或邮箱' : '搜索邀请邮箱'"
                            class="min-w-0 flex-1 @min-[600px]/team-management:w-60"
                            maxlength="100"
                        />
                    </Field>
                    <Button variant="outline" :disabled="team.loading || team.busy">搜索</Button>
                </form>
            </div>
            <div v-else class="flex flex-wrap items-center gap-3">
                <ButtonGroup aria-label="角色视图">
                    <Button
                        :variant="roleView === 'list' ? 'secondary' : 'outline'"
                        :aria-pressed="roleView === 'list'"
                        @click="roleView = 'list'"
                    >
                        <List />
                        列表
                    </Button>
                    <Button
                        v-if="team.data.definitions.length"
                        :variant="roleView === 'matrix' ? 'secondary' : 'outline'"
                        :aria-pressed="roleView === 'matrix'"
                        @click="roleView = 'matrix'"
                    >
                        <Grid2X2 />
                        权限矩阵
                    </Button>
                </ButtonGroup>
                <SelectField
                    v-if="!context"
                    v-model="roleFilter"
                    label="角色作用域筛选"
                    :options="[
                        { value: 'all', label: '全部作用域' },
                        { value: 'ORGANIZATION', label: '组织' },
                        { value: 'WORKSPACE', label: '工作区' },
                    ]"
                />
                <Input
                    v-model="roleSearch"
                    class="w-full @min-[600px]/team-management:ml-auto @min-[600px]/team-management:w-64"
                    aria-label="搜索角色名称或标识"
                    placeholder="搜索角色名称或标识"
                />
            </div>
            <p v-if="view === 'roles'" class="text-sm text-muted-foreground">
                {{ filteredRoles.length }} 个角色
                <span v-if="roleSearch || roleFilter !== 'all'">，目录共 {{ team.data.roles.length }} 个</span>
            </p>
            <TeamPermissionMatrix
                v-if="view === 'roles' && roleView === 'matrix'"
                :roles="filteredRoles"
                :definitions="matrixDefinitions"
            />
            <div
                v-else
                class="min-w-0 overflow-x-auto scroll-smooth rounded-lg border bg-card motion-reduce:scroll-auto"
                :aria-busy="team.loading"
            >
                <Table
                    container-class="overflow-visible"
                    class="table-fixed [&_th]:px-2.5 [&_td]:px-2.5 [&_td]:py-3"
                    :class="view === 'roles' ? (context ? 'min-w-[768px]' : 'min-w-[640px]') : 'min-w-[960px]'"
                >
                    <caption class="sr-only">
                        {{ view === 'roles' ? '角色与权限' : tab === 'members' ? '成员' : '邀请' }}
                    </caption>
                    <colgroup v-if="view === 'roles'">
                        <col class="w-60" />
                        <col class="w-36" />
                        <col v-if="context" class="w-28" />
                        <col />
                        <col class="w-36" />
                    </colgroup>
                    <colgroup v-else>
                        <col class="w-60" />
                        <col class="w-64" />
                        <col />
                        <col class="w-24" />
                        <col class="w-36" />
                    </colgroup>
                    <TableHeader>
                        <TableRow>
                            <template v-if="view === 'roles'">
                                <TableHead>角色</TableHead>
                                <TableHead>作用域</TableHead>
                                <TableHead v-if="context" class="w-28 text-center">本区绑定</TableHead>
                                <TableHead>权限</TableHead>
                            </template>
                            <template v-else-if="tab === 'members'">
                                <TableHead>成员</TableHead>
                                <TableHead>邮箱</TableHead>
                                <TableHead>角色</TableHead>
                                <TableHead>状态</TableHead>
                            </template>
                            <template v-else>
                                <TableHead>邮箱</TableHead>
                                <TableHead>工作区</TableHead>
                                <TableHead>有效期</TableHead>
                                <TableHead>状态</TableHead>
                            </template>
                            <TableHead class="w-36 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <template v-if="view === 'roles'">
                            <TableRow v-for="role in filteredRoles" :key="role.id">
                                <TableCell class="relative whitespace-normal break-words font-medium">
                                    <button
                                        class="group flex w-full items-start gap-3 text-left after:absolute after:inset-0"
                                        :aria-label="`预览角色 ${role.name}`"
                                        @click="preview = { kind: 'role', id: role.id }"
                                    >
                                        <ShieldCheck
                                            class="mt-0.5 size-5 shrink-0 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <span class="min-w-0">
                                            <span class="block group-hover:underline group-focus-visible:underline">
                                                {{ role.name }}
                                            </span>
                                            <span
                                                class="mt-1 block break-all font-mono text-xs font-normal text-muted-foreground"
                                            >
                                                {{ role.code }}
                                            </span>
                                        </span>
                                    </button>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary">
                                        {{ role.scope === 'ORGANIZATION' ? '组织' : '工作区' }}
                                    </Badge>
                                    <span v-if="role.protected" class="mt-1 block text-xs text-muted-foreground">
                                        系统保护
                                    </span>
                                </TableCell>
                                <TableCell v-if="context" class="text-center">
                                    {{ context.roleBindings[role.id] ?? 0 }}
                                </TableCell>
                                <TableCell class="whitespace-normal break-words text-sm text-muted-foreground">
                                    {{ role.permissions.slice(0, 3).map(permissionName).join('、') || '—' }}
                                    <span v-if="role.permissions.length > 3" class="mt-1 block text-xs">
                                        共 {{ role.permissions.length }} 项
                                    </span>
                                </TableCell>
                                <TableCell class="text-right">
                                    <TeamActionMenu
                                        :name="role.name"
                                        :detail="() => openRoleDetail(role)"
                                        :disabled="disabled"
                                        :actions="roleActions(role)"
                                        @preview="preview = { kind: 'role', id: role.id }"
                                    />
                                </TableCell>
                            </TableRow>
                        </template>
                        <template v-else-if="tab === 'members'">
                            <TableRow v-for="member in team.data.members" :key="member.id">
                                <TableCell class="relative whitespace-normal">
                                    <button
                                        class="group flex w-full items-center gap-3 text-left after:absolute after:inset-0"
                                        :aria-label="`预览成员 ${member.name}`"
                                        @click="preview = { kind: 'member', id: member.id }"
                                    >
                                        <Avatar class="size-9 shrink-0">
                                            <AvatarFallback class="bg-primary-soft text-primary">
                                                {{ Array.from(member.name)[0] }}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div class="min-w-0">
                                            <span
                                                class="block break-words font-medium group-hover:underline group-focus-visible:underline"
                                            >
                                                {{ member.name }}
                                            </span>
                                            <span
                                                v-if="member.isOwner"
                                                class="mt-1 block text-xs text-muted-foreground"
                                            >
                                                所有者
                                            </span>
                                        </div>
                                    </button>
                                </TableCell>
                                <TableCell class="whitespace-normal break-all text-muted-foreground">
                                    {{ member.email }}
                                </TableCell>
                                <TableCell>
                                    <div class="flex flex-wrap gap-1.5">
                                        <Badge
                                            v-for="role in member.roles"
                                            :key="role.id"
                                            variant="secondary"
                                            class="h-auto min-h-5 max-w-full rounded-sm whitespace-normal break-words py-0.5"
                                        >
                                            {{ role.name }}
                                        </Badge>
                                        <span v-if="!member.roles.length" class="text-muted-foreground">—</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <StateBadge :tone="member.status === 'ACTIVE' ? 'success' : 'neutral'">
                                        {{ status(member.status) }}
                                    </StateBadge>
                                </TableCell>
                                <TableCell class="text-right">
                                    <TeamActionMenu
                                        :name="member.name"
                                        :detail="() => openMemberDetail(member)"
                                        :disabled="disabled"
                                        :actions="memberActions(member)"
                                        @preview="preview = { kind: 'member', id: member.id }"
                                    />
                                </TableCell>
                            </TableRow>
                        </template>
                        <template v-else>
                            <TableRow v-for="invitation in team.data.invitations" :key="invitation.id">
                                <TableCell class="relative whitespace-normal break-all">
                                    <button
                                        class="group w-full text-left after:absolute after:inset-0"
                                        :aria-label="`预览邀请 ${invitation.email}`"
                                        @click="preview = { kind: 'invitation', id: invitation.id }"
                                    >
                                        <span class="group-hover:underline group-focus-visible:underline">
                                            {{ invitation.email }}
                                        </span>
                                    </button>
                                </TableCell>
                                <TableCell class="whitespace-normal break-words">
                                    {{ invitation.workspaceName || '组织' }}
                                </TableCell>
                                <TableCell class="whitespace-normal tabular-nums">
                                    {{ new Date(invitation.expiresAt).toLocaleString() }}
                                </TableCell>
                                <TableCell>
                                    <StateBadge
                                        :tone="
                                            invitation.status === 'accepted'
                                                ? 'success'
                                                : invitation.status === 'pending'
                                                  ? 'warning'
                                                  : 'neutral'
                                        "
                                    >
                                        {{ status(invitation.status) }}
                                    </StateBadge>
                                </TableCell>
                                <TableCell class="text-right">
                                    <TeamActionMenu
                                        :name="invitation.email"
                                        :disabled="disabled"
                                        :actions="invitationActions(invitation)"
                                        @preview="preview = { kind: 'invitation', id: invitation.id }"
                                    />
                                </TableCell>
                            </TableRow>
                        </template>
                        <TableRow
                            v-if="
                                view === 'roles'
                                    ? !filteredRoles.length
                                    : !(tab === 'members' ? team.data.members.length : team.data.invitations.length)
                            "
                        >
                            <TableCell
                                :colspan="view === 'roles' && !context ? 4 : 5"
                                class="h-28 text-center text-muted-foreground"
                            >
                                {{
                                    (
                                        view === 'roles'
                                            ? roleSearch || roleFilter !== 'all'
                                            : team.data.page && team.search
                                    )
                                        ? '没有匹配的记录'
                                        : tab === 'invitations'
                                          ? '当前范围暂无邀请'
                                          : '当前范围暂无记录'
                                }}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
            <div v-if="view === 'members'" class="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span class="text-muted-foreground">共 {{ total }} 项</span>
                <div class="ml-auto flex items-center gap-3">
                    <SelectField
                        v-model="pageSize"
                        label="每页条数"
                        hide-title
                        :options="[
                            { value: '20', label: '20 条' },
                            { value: '50', label: '50 条' },
                            { value: '100', label: '100 条' },
                        ]"
                        :disabled="disabled"
                    />
                    <span>第 {{ team.data.page }} / {{ pages }} 页</span>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        use-tooltip
                        aria-label="上一页"
                        :disabled="team.data.page <= 1 || disabled"
                        @click="goToPage(team.data.page - 1)"
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        use-tooltip
                        aria-label="下一页"
                        :disabled="team.data.page >= pages || disabled"
                        @click="goToPage(team.data.page + 1)"
                    >
                        <ChevronRight />
                    </Button>
                </div>
            </div>
        </template>
    </section>
    <SheetInspector
        v-model:open="previewOpen"
        :title="previewRecord?.name ?? '团队记录预览'"
        description="当前组织范围内的记录摘要"
    >
        <ScrollSurface v-if="previewRecord" class="min-h-0 flex-1 p-6 pt-10">
            <p class="mb-2 text-sm text-muted-foreground">{{ organizationName }} · {{ previewRecord.kind }}</p>
            <h2 class="mb-3 break-words pr-6 text-lg font-semibold">{{ previewRecord.name }}</h2>
            <CopyableId :value="previewRecord.id" :label="previewRecord.kind + ' ID'" />
            <dl class="mt-6 grid grid-cols-[6rem_minmax(0,1fr)] gap-4 border-t pt-6 text-sm">
                <dt class="text-muted-foreground">查询范围</dt>
                <dd class="break-words">{{ view === 'roles' ? '组织角色目录' : scopeName }}</dd>
                <template v-for="field in previewRecord.fields" :key="field.label">
                    <dt class="text-muted-foreground">{{ field.label }}</dt>
                    <dd class="break-words whitespace-pre-wrap">{{ field.value }}</dd>
                </template>
            </dl>
        </ScrollSurface>
    </SheetInspector>
    <Dialog v-model:open="guardedOpen">
        <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg" :aria-describedby="undefined">
            <DialogHeader>
                <DialogTitle class="break-words pr-6">
                    {{
                        modal === 'invite'
                            ? '邀请已有账户'
                            : modal === 'add-member'
                              ? '添加组织成员'
                              : modal === 'bindings'
                                ? `分配角色：${selectedMember?.name}`
                                : modal === 'role'
                                  ? selectedRole
                                      ? '编辑角色'
                                      : '新建角色'
                                  : confirmationTitle
                    }}
                </DialogTitle>
                <p class="break-words text-sm text-muted-foreground">
                    {{ organizationName }} ·
                    {{ modal === 'role' ? (roleScope === 'ORGANIZATION' ? '组织角色' : '工作区角色定义') : scopeName }}
                </p>
            </DialogHeader>
            <form class="space-y-4" @submit.prevent="submit">
                <p v-if="modal === 'confirm'" class="break-words text-sm">{{ confirmationDescription }}</p>
                <Field v-if="modal === 'invite' || modal === 'add-member'">
                    <FieldLabel :for="formFieldId + '-1'">账户邮箱</FieldLabel>
                    <Input
                        :id="formFieldId + '-1'"
                        v-model="email"
                        type="email"
                        required
                        maxlength="254"
                        :disabled="disabled"
                    />
                </Field>
                <template v-if="modal === 'role'">
                    <Field>
                        <FieldLabel :for="formFieldId + '-2'">角色名称</FieldLabel>
                        <Input
                            :id="formFieldId + '-2'"
                            v-model="roleName"
                            required
                            maxlength="40"
                            :disabled="disabled"
                        />
                    </Field>
                    <Field v-if="!selectedRole">
                        <FieldLabel :for="formFieldId + '-3'">角色标识</FieldLabel>
                        <Input
                            :id="formFieldId + '-3'"
                            v-model="roleCode"
                            required
                            pattern="[a-z][a-z0-9-]*"
                            maxlength="120"
                            :disabled="disabled"
                        />
                    </Field>
                    <Field>
                        <FieldLabel :for="standaloneFieldId + '-1'">角色作用域</FieldLabel>
                        <SelectField
                            :id="standaloneFieldId + '-1'"
                            v-model="roleScope"
                            label="角色作用域"
                            :options="[
                                { value: 'ORGANIZATION', label: '组织' },
                                { value: 'WORKSPACE', label: '工作区' },
                            ]"
                            :disabled="!!selectedRole || disabled"
                            @update:model-value="permissions = []"
                        />
                    </Field>
                    <TeamPermissionField
                        :key="roleScope"
                        v-model="permissions"
                        :definitions="definitions"
                        :disabled="disabled"
                    />
                </template>
                <div v-if="modal === 'bindings'" class="grid gap-3">
                    <Field
                        v-for="role in team.data?.roles.filter(
                            (item) => item.grantable || selectedMember?.roles.some((binding) => binding.id === item.id)
                        )"
                        :key="role.id"
                        orientation="horizontal"
                        class="items-center"
                    >
                        <Checkbox
                            :id="formFieldId + '-4' + '-' + role.id"
                            :model-value="roleIds.includes(role.id)"
                            :disabled="
                                disabled ||
                                (!role.grantable && !selectedMember?.roles.some((binding) => binding.id === role.id))
                            "
                            @update:model-value="(value) => (roleIds = toggle(roleIds, role.id, value))"
                        />
                        <FieldLabel :for="formFieldId + '-4' + '-' + role.id" class="font-normal">
                            {{ role.name }}
                        </FieldLabel>
                        <span v-if="!role.grantable" class="text-xs text-muted-foreground">当前不可新增授予</span>
                    </Field>
                    <p
                        v-if="
                            !team.data?.roles.some(
                                (item) =>
                                    item.grantable || selectedMember?.roles.some((binding) => binding.id === item.id)
                            )
                        "
                        class="text-sm text-muted-foreground"
                    >
                        当前范围暂无可分配角色
                    </p>
                </div>
                <FieldError v-if="formError" role="alert" class="text-sm text-destructive">
                    {{ formError }}
                </FieldError>
                <DataSyncNotice
                    scope="团队管理"
                    :error="team.syncError"
                    :pending="team.syncPending"
                    :busy="team.busy || team.loading"
                    @retry="reload"
                />
                <DialogFooter>
                    <Button type="button" variant="outline" :disabled="team.busy" @click="guardedOpen = false">
                        取消
                    </Button>
                    <Button type="submit" :disabled="disabled">{{ team.busy ? '正在提交' : '确认' }}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    <OverlayDraftDialog v-model:open="confirmOpen" @discard="discard" />
</template>
