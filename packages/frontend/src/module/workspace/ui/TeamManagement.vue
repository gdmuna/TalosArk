<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
} from '@lucide/vue';
import type { TeamMember, TeamRole, TeamRoleBody } from '@talos-ark/contracts/team';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/checkbox';
import { Avatar, AvatarFallback } from '@/ui/avatar';
import { Badge } from '@/ui/badge';
import { StateBadge } from '@/component/state-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog';
import { SelectField } from '@/component/select-field';
import { useWorkspaceStore } from '../model/store';
import { useTeamStore } from '../model/team-store';
import type { TeamCommand } from '../data/team-source';

const props = defineProps<{ view: 'members' | 'roles' }>();
const workspace = useWorkspaceStore(),
    team = useTeamStore();
const organizationId = ref(workspace.organization?.id ?? workspace.organizations[0]?.id ?? '');
const workspaceId = ref('organization');
const selectedWorkspaceId = computed(() => (workspaceId.value === 'organization' ? undefined : workspaceId.value));
const tab = ref<'members' | 'invitations'>('members');
const search = ref('');
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
const disabled = computed(() => team.busy || team.loading || !!team.syncError);
const definitions = computed(() => team.data?.definitions.filter((item) => item.scope === roleScope.value) ?? []);
const total = computed(() =>
    props.view === 'roles'
        ? (team.data?.roles.length ?? 0)
        : tab.value === 'members'
          ? (team.data?.memberTotal ?? 0)
          : (team.data?.invitationTotal ?? 0)
);
const pages = computed(() => Math.max(1, Math.ceil(total.value / team.pageSize)));
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
    [organizationId, workspaceId, () => workspace.activeId],
    async () => {
        modal.value = null;
        if (!organizationId.value) {
            team.reset();
            return;
        }
        if (!scopeOptions.value.some((item) => item.value === workspaceId.value)) workspaceId.value = 'organization';
        await team.select({ organizationId: organizationId.value, workspaceId: selectedWorkspaceId.value });
    },
    { immediate: true }
);
watch(tab, () => {
    team.page = 1;
    void reload();
});
async function reload() {
    try {
        await team.load();
    } catch {
        /* Error and retry stay visible. */
    }
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
                  role: { name: body.name, permissions: body.permissions },
              }
            : { kind: 'create-role', role: body };
    }
    if (!command) return;
    const success = await team.mutate(command);
    if (current !== generation) return;
    if (success) modal.value = null;
    else formError.value = team.error || '当前状态尚未同步，请重新检查';
}
</script>

<template>
    <section class="@container/team-management min-w-0 space-y-4">
        <div class="flex flex-wrap items-center gap-3">
            <SelectField v-model="organizationId" label="组织" :options="organizationOptions" :disabled="team.busy" />
            <SelectField
                v-if="view === 'members'"
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
        <p v-if="team.error" role="alert" class="text-sm text-destructive">{{ team.error }}</p>
        <p v-if="team.syncError" role="alert" class="text-sm text-destructive">{{ team.syncError }}</p>
        <p v-if="team.notice" role="status" class="text-sm text-muted-foreground">{{ team.notice }}</p>
        <p v-if="!organizationId" class="py-10 text-center text-sm text-muted-foreground">暂无可用组织</p>
        <template v-else-if="team.data">
            <div v-if="view === 'members'" class="flex flex-wrap items-center gap-3">
                <div class="flex rounded-md border p-0.5" aria-label="成员视图">
                    <Button :variant="tab === 'members' ? 'secondary' : 'ghost'" size="sm" @click="tab = 'members'">
                        成员
                    </Button>
                    <Button
                        v-if="team.data.canInvite"
                        :variant="tab === 'invitations' ? 'secondary' : 'ghost'"
                        size="sm"
                        @click="tab = 'invitations'"
                    >
                        邀请
                    </Button>
                </div>
                <form
                    class="flex w-full gap-2 @min-[600px]/team-management:ml-auto @min-[600px]/team-management:w-auto"
                    @submit.prevent="
                        team.search = search;
                        team.page = 1;
                        reload();
                    "
                >
                    <Input
                        v-model="search"
                        aria-label="搜索成员或邮箱"
                        placeholder="搜索成员或邮箱"
                        class="min-w-0 flex-1 @min-[600px]/team-management:w-60"
                        maxlength="100"
                    />
                    <Button variant="outline" :disabled="team.loading">搜索</Button>
                </form>
            </div>
            <div class="min-w-0 overflow-x-auto scroll-smooth rounded-lg border bg-card motion-reduce:scroll-auto">
                <Table
                    class="table-fixed [&_th]:px-2.5 [&_td]:px-2.5 [&_td]:py-3"
                    :class="view === 'roles' ? 'min-w-[640px]' : 'min-w-[960px]'"
                >
                    <caption class="sr-only">
                        {{ view === 'roles' ? '角色与权限' : tab === 'members' ? '成员' : '邀请' }}
                    </caption>
                    <colgroup v-if="view === 'roles'">
                        <col class="w-60" />
                        <col class="w-28" />
                        <col />
                        <col class="w-28" />
                    </colgroup>
                    <colgroup v-else>
                        <col class="w-60" />
                        <col class="w-64" />
                        <col />
                        <col class="w-24" />
                        <col class="w-28" />
                    </colgroup>
                    <TableHeader>
                        <TableRow>
                            <template v-if="view === 'roles'">
                                <TableHead>角色</TableHead>
                                <TableHead>作用域</TableHead>
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
                            <TableHead class="w-28 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <template v-if="view === 'roles'">
                            <TableRow v-for="role in team.data.roles" :key="role.id">
                                <TableCell class="whitespace-normal break-words font-medium">
                                    <span class="flex items-start gap-3">
                                        <ShieldCheck
                                            class="mt-0.5 size-5 shrink-0 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        {{ role.name }}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary">
                                        {{ role.scope === 'ORGANIZATION' ? '组织' : '工作区' }}
                                    </Badge>
                                </TableCell>
                                <TableCell class="whitespace-normal break-words text-sm text-muted-foreground">
                                    {{
                                        role.permissions
                                            .map(
                                                (code) =>
                                                    team.data?.definitions.find((item) => item.code === code)?.name ??
                                                    code
                                            )
                                            .join('、') || '—'
                                    }}
                                </TableCell>
                                <TableCell class="text-right">
                                    <Button
                                        v-if="team.data.canManageRoles && !role.protected"
                                        variant="ghost"
                                        size="icon-sm"
                                        use-tooltip
                                        :aria-label="`编辑角色 ${role.name}`"
                                        :disabled="disabled"
                                        @click="editRole(role)"
                                    >
                                        <Pencil />
                                    </Button>
                                    <Button
                                        v-if="team.data.canManageRoles && !role.protected"
                                        variant="ghost"
                                        size="icon-sm"
                                        use-tooltip
                                        :aria-label="`归档角色 ${role.name}`"
                                        :disabled="disabled"
                                        @click="
                                            confirm(`归档角色「${role.name}」？`, { kind: 'archive-role', id: role.id })
                                        "
                                    >
                                        <Archive />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        </template>
                        <template v-else-if="tab === 'members'">
                            <TableRow v-for="member in team.data.members" :key="member.id">
                                <TableCell class="whitespace-normal">
                                    <div class="flex items-center gap-3">
                                        <Avatar class="size-9 shrink-0">
                                            <AvatarFallback class="bg-primary-soft text-primary">
                                                {{ Array.from(member.name)[0] }}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div class="min-w-0">
                                            <span class="block break-words font-medium">{{ member.name }}</span>
                                            <span
                                                v-if="member.isOwner"
                                                class="mt-1 block text-xs text-muted-foreground"
                                            >
                                                所有者
                                            </span>
                                        </div>
                                    </div>
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
                                    <Button
                                        v-if="
                                            team.data.canManageMembers && member.status === 'ACTIVE' && !member.isOwner
                                        "
                                        variant="ghost"
                                        size="icon-sm"
                                        use-tooltip
                                        :aria-label="`分配角色 ${member.name}`"
                                        :disabled="disabled"
                                        @click="editBindings(member)"
                                    >
                                        <ShieldCheck />
                                    </Button>
                                    <Button
                                        v-if="team.data.canManageMembers && member.status !== 'LEFT' && !member.isOwner"
                                        variant="ghost"
                                        size="icon-sm"
                                        use-tooltip
                                        :aria-label="`移除成员 ${member.name}`"
                                        :disabled="disabled"
                                        @click="
                                            confirm(`移除成员「${member.name}」？`, {
                                                kind: 'remove-member',
                                                id: member.id,
                                            })
                                        "
                                    >
                                        <UserMinus />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        </template>
                        <template v-else>
                            <TableRow v-for="invitation in team.data.invitations" :key="invitation.id">
                                <TableCell class="whitespace-normal break-all">{{ invitation.email }}</TableCell>
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
                                    <Button
                                        v-if="invitation.status === 'pending' || invitation.status === 'expired'"
                                        variant="ghost"
                                        size="icon-sm"
                                        use-tooltip
                                        :aria-label="`重发邀请 ${invitation.email}`"
                                        :disabled="disabled"
                                        @click="team.mutate({ kind: 'resend', id: invitation.id })"
                                    >
                                        <Send />
                                    </Button>
                                    <Button
                                        v-if="invitation.status === 'pending' || invitation.status === 'expired'"
                                        variant="ghost"
                                        size="icon-sm"
                                        use-tooltip
                                        :aria-label="`撤销邀请 ${invitation.email}`"
                                        :disabled="disabled"
                                        @click="confirm('撤销此邀请？', { kind: 'revoke', id: invitation.id })"
                                    >
                                        <X />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        </template>
                        <TableRow v-if="!total">
                            <TableCell
                                :colspan="view === 'roles' ? 4 : 5"
                                class="h-28 text-center text-muted-foreground"
                            >
                                暂无记录
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
            <div v-if="view === 'members'" class="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span class="text-muted-foreground">共 {{ total }} 项</span>
                <div class="ml-auto flex items-center gap-3">
                    <span>第 {{ team.page }} / {{ pages }} 页</span>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        use-tooltip
                        aria-label="上一页"
                        :disabled="team.page <= 1 || disabled"
                        @click="
                            team.page--;
                            reload();
                        "
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        use-tooltip
                        aria-label="下一页"
                        :disabled="team.page >= pages || disabled"
                        @click="
                            team.page++;
                            reload();
                        "
                    >
                        <ChevronRight />
                    </Button>
                </div>
            </div>
        </template>
        <p v-else-if="team.loading" role="status" class="py-10 text-center text-sm text-muted-foreground">正在加载</p>
    </section>
    <Dialog
        :open="modal !== null"
        @update:open="
            (value) => {
                if (!value) modal = null;
            }
        "
    >
        <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg" :aria-describedby="undefined">
            <DialogHeader>
                <DialogTitle>
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
            </DialogHeader>
            <form class="space-y-4" @submit.prevent="submit">
                <label v-if="modal === 'invite' || modal === 'add-member'" class="grid gap-2 text-sm">
                    账户邮箱
                    <Input v-model="email" type="email" required maxlength="254" :disabled="team.busy" />
                </label>
                <template v-if="modal === 'role'">
                    <label class="grid gap-2 text-sm">
                        角色名称
                        <Input v-model="roleName" required maxlength="40" :disabled="team.busy" />
                    </label>
                    <label v-if="!selectedRole" class="grid gap-2 text-sm">
                        角色标识
                        <Input
                            v-model="roleCode"
                            required
                            pattern="[a-z][a-z0-9-]*"
                            maxlength="120"
                            :disabled="team.busy"
                        />
                    </label>
                    <SelectField
                        v-model="roleScope"
                        label="角色作用域"
                        :options="[
                            { value: 'ORGANIZATION', label: '组织' },
                            { value: 'WORKSPACE', label: '工作区' },
                        ]"
                        :disabled="!!selectedRole || team.busy"
                        @update:model-value="permissions = []"
                    />
                    <div class="grid gap-3">
                        <label
                            v-for="definition in definitions"
                            :key="definition.code"
                            class="flex items-center gap-3 text-sm"
                        >
                            <Checkbox
                                :model-value="permissions.includes(definition.code)"
                                :disabled="team.busy"
                                @update:model-value="
                                    (value) => (permissions = toggle(permissions, definition.code, value))
                                "
                            />
                            {{ definition.name }}
                        </label>
                    </div>
                </template>
                <div v-if="modal === 'bindings'" class="grid gap-3">
                    <label
                        v-for="role in team.data?.roles.filter((item) => item.grantable)"
                        :key="role.id"
                        class="flex items-center gap-3 text-sm"
                    >
                        <Checkbox
                            :model-value="roleIds.includes(role.id)"
                            :disabled="team.busy"
                            @update:model-value="(value) => (roleIds = toggle(roleIds, role.id, value))"
                        />
                        {{ role.name }}
                    </label>
                </div>
                <p v-if="formError || team.syncError" role="alert" class="text-sm text-destructive">
                    {{ formError || team.syncError }}
                </p>
                <DialogFooter>
                    <Button type="button" variant="outline" @click="modal = null">取消</Button>
                    <Button type="submit" :disabled="disabled">{{ team.busy ? '正在提交' : '确认' }}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
