import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import type { TeamManagement } from '@talos-ark/contracts/team';
import { HttpError } from '@/platform/http';
import { createTaskScope } from '@/platform/task';
import { useWorkspaceStore } from './store';
import type { TeamDataSource, TeamSelection, TeamCommand } from '../data/source';

export function teamErrorMessage(error: unknown): string {
    const code = error instanceof HttpError ? error.code : undefined;
    return (
        (
            {
                TEAM_ACCESS_DENIED: '当前账户无权执行此操作',
                TEAM_CONFLICT: '操作与当前状态冲突，请重新加载后检查',
                TEAM_ACCOUNT_UNAVAILABLE: '需要使用已开户且符合条件的账户邮箱',
                TEAM_INVITATION_INVALID: '邀请已失效，或与当前登录账户不匹配',
                TEAM_UNAVAILABLE: '暂时无法完成操作，请稍后重试',
            } as Record<string, string>
        )[code ?? ''] ??
        (error instanceof HttpError && error.kind === 'network'
            ? '无法连接服务，请检查网络后重试'
            : error instanceof Error
              ? error.message
              : '操作失败')
    );
}

export const useTeamStore = defineStore('team-management', () => {
    const workspace = useWorkspaceStore();
    const selection = shallowRef<TeamSelection | null>(null);
    const data = shallowRef<TeamManagement | null>(null);
    const loading = ref(false),
        busy = ref(false),
        error = ref(''),
        syncError = ref(''),
        notice = ref('');
    const page = ref(1),
        pageSize = ref(20),
        search = ref('');
    let source: TeamDataSource;
    let scope = createTaskScope([]);
    let readVersion = 0;
    let pendingLeaveSync = false;
    const ready = computed(() => !!data.value && !loading.value);
    function connect(value: TeamDataSource) {
        reset();
        source = value;
    }
    function reset() {
        scope.dispose();
        scope = createTaskScope([]);
        readVersion++;
        pendingLeaveSync = false;
        selection.value = null;
        data.value = null;
        loading.value = busy.value = false;
        error.value = syncError.value = notice.value = '';
        page.value = 1;
        search.value = '';
    }
    async function load(): Promise<void> {
        const selected = selection.value;
        if (!selected) return;
        const current = scope;
        const version = ++readVersion;
        loading.value = true;
        error.value = '';
        try {
            if (pendingLeaveSync) {
                await workspace.load(current.signal);
                if (current === scope) reset();
                return;
            }
            const result = await source.load(
                selected,
                { page: page.value, pageSize: pageSize.value, search: search.value },
                current.signal
            );
            current.signal.throwIfAborted();
            if (version !== readVersion) return;
            data.value = result;
            syncError.value = '';
        } catch (cause) {
            if (!current.signal.aborted && version === readVersion) {
                if (pendingLeaveSync)
                    syncError.value = '已离开，但工作区列表未同步。请重新加载，不要重复提交。';
                else error.value = teamErrorMessage(cause);
                throw cause;
            }
        } finally {
            if (version === readVersion) loading.value = false;
        }
    }
    async function select(value: TeamSelection) {
        reset();
        selection.value = value;
        try {
            await load();
        } catch {
            /* The view owns retry for a failed read. */
        }
    }
    async function mutate(command: TeamCommand): Promise<boolean> {
        if (!selection.value || busy.value || loading.value || syncError.value) return false;
        const selected = selection.value,
            current = scope;
        busy.value = true;
        error.value = notice.value = '';
        try {
            const result = await source.mutate(selected, command, current.signal);
            current.signal.throwIfAborted();
            if (result.delivery)
                notice.value =
                    result.delivery === 'queued'
                        ? '邀请已提交发送，尚未确认送达'
                        : '邀请已创建，但未能加入发送队列，请稍后重发';
            if (command.kind === 'leave') {
                pendingLeaveSync = true;
                data.value = null;
                try {
                    await load();
                } catch {
                    /* A committed leave is recovered by reading workspace state only. */
                }
                return true;
            }
            try {
                await load();
            } catch {
                if (!current.signal.aborted)
                    syncError.value = '变更已提交，但列表未同步。请重新加载，不要重复提交。';
            }
            return !current.signal.aborted;
        } catch (cause) {
            if (!current.signal.aborted) error.value = teamErrorMessage(cause);
            return false;
        } finally {
            if (current === scope) busy.value = false;
        }
    }
    watch(
        () => workspace.activeId,
        () => reset()
    );
    onScopeDispose(() => scope.dispose());
    return {
        selection,
        data,
        loading,
        busy,
        error,
        syncError,
        notice,
        page,
        pageSize,
        search,
        ready,
        connect,
        reset,
        select,
        load,
        mutate,
        inspect: (token: string, signal: AbortSignal) => source.inspect(token, signal),
        accept: (token: string, signal: AbortSignal) => source.accept(token, signal),
    };
});
