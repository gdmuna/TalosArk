import { computed, onScopeDispose, ref } from 'vue';
import { defineStore } from 'pinia';
import { createTaskScope, waitFor } from '@/platform/task';
import { HttpError, isResponseValidationError } from '@/platform/http';
import type { WorkspaceDataSource } from '../data/source';
import type { Organization, Workspace, WorkspaceSnapshot } from './workspace';

export const useWorkspaceStore = defineStore('workspace-context', () => {
    const organizations = ref<Organization[]>([]);
    const workspaces = ref<Workspace[]>([]);
    const activeId = ref('');
    const busy = ref(false);
    const error = ref('');
    const syncError = ref('');
    const syncPending = ref(false);
    const switching = ref(false);
    const canCreateOrganization = ref(false);
    const canJoin = ref(false);
    let pendingSelection: string | undefined;
    let source: WorkspaceDataSource;
    let sourceScope = createTaskScope([]);
    let selectionScope = createTaskScope([sourceScope.signal]);
    onScopeDispose(() => {
        sourceScope.dispose();
        selectionScope.dispose();
    });
    const current = computed(() => workspaces.value.find((item) => item.id === activeId.value));
    const organization = computed(() =>
        organizations.value.find((item) => item.id === current.value?.organizationId)
    );

    function connect(dataSource: WorkspaceDataSource) {
        sourceScope.dispose();
        sourceScope = createTaskScope([]);
        source = dataSource;
        selectionScope.dispose();
        selectionScope = createTaskScope([sourceScope.signal]);
        canCreateOrganization.value = !!dataSource.createOrganization;
        canJoin.value = !!dataSource.join;
    }
    function reset() {
        sourceScope.dispose();
        sourceScope = createTaskScope([]);
        selectionScope.dispose();
        selectionScope = createTaskScope([sourceScope.signal]);
        organizations.value = [];
        workspaces.value = [];
        activeId.value = '';
        pendingSelection = undefined;
        busy.value = false;
        switching.value = false;
        error.value = syncError.value = '';
        syncPending.value = false;
    }
    async function load(signal?: AbortSignal) {
        const task = createTaskScope([sourceScope.signal, signal]);
        try {
            task.signal.throwIfAborted();
            const snapshot = await waitFor(source.load(task.signal), task.signal);
            task.signal.throwIfAborted();
            apply(snapshot);
        } finally {
            task.dispose();
        }
    }
    async function initialize(dataSource: WorkspaceDataSource) {
        connect(dataSource);
        await load();
    }
    function applySelection(id: string) {
        if (activeId.value !== id) {
            sourceScope.dispose();
            sourceScope = createTaskScope([]);
            busy.value = false;
        }
        activeId.value = id;
    }
    function apply(snapshot: WorkspaceSnapshot) {
        organizations.value = snapshot.organizations;
        workspaces.value = snapshot.workspaces;
        const selected = [pendingSelection, activeId.value, snapshot.activeId].find((id) =>
            snapshot.workspaces.some((item) => item.id === id)
        );
        applySelection(selected ?? snapshot.workspaces[0]?.id ?? '');
        pendingSelection = undefined;
    }
    async function select(id: string) {
        const target = workspaces.value.find((item) => item.id === id);
        if (!target) return '工作区不存在';
        selectionScope.dispose();
        const scope = createTaskScope([sourceScope.signal]);
        selectionScope = scope;
        switching.value = true;
        error.value = '';
        try {
            await source.select?.(target, scope.signal);
            scope.signal.throwIfAborted();
            if (scope !== selectionScope) return '工作区切换已取消';
            applySelection(id);
            pendingSelection = undefined;
            return '';
        } catch (cause) {
            if (scope.signal.aborted) return '工作区切换已取消';
            if (isResponseValidationError(cause)) return null;
            if (cause instanceof HttpError && cause.status === 403) {
                workspaces.value = workspaces.value.filter((item) => item.id !== id);
                if (activeId.value === id) applySelection('');
                error.value = '当前账户已无权进入此工作区';
            } else error.value = cause instanceof Error ? cause.message : '工作区切换失败';
            return error.value;
        } finally {
            if (scope === selectionScope) switching.value = false;
            scope.dispose();
        }
    }
    async function synchronize() {
        const scope = sourceScope;
        try {
            const snapshot = await source.load(scope.signal);
            scope.signal.throwIfAborted();
            if (
                pendingSelection &&
                !snapshot.workspaces.some((item) => item.id === pendingSelection)
            ) {
                throw new HttpError('新工作区尚未出现在同步结果中', 'protocol');
            }
            apply(snapshot);
            syncError.value = '';
            syncPending.value = false;
            return true;
        } catch (cause) {
            if (!scope.signal.aborted)
                syncError.value = isResponseValidationError(cause)
                    ? ''
                    : cause instanceof Error
                      ? cause.message
                      : '工作区同步失败';
            return false;
        }
    }
    async function retrySync() {
        if (busy.value || !syncPending.value) return;
        busy.value = true;
        const scope = sourceScope;
        try {
            await synchronize();
        } finally {
            if (scope === sourceScope) busy.value = false;
        }
    }
    async function mutate(operation: (signal: AbortSignal) => Promise<string>) {
        if (busy.value) return '工作区正在更新';
        if (switching.value) return '正在切换工作区';
        if (syncPending.value) return syncError.value || null;
        busy.value = true;
        error.value = '';
        const scope = sourceScope;
        try {
            const selection = await operation(scope.signal);
            scope.signal.throwIfAborted();
            pendingSelection = selection;
            syncPending.value = true;
            if (!(await synchronize()) && !syncError.value) return null;
        } catch (cause) {
            if (scope.signal.aborted) return '操作上下文已改变，请重新检查操作结果';
            if (isResponseValidationError(cause)) return null;
            if (!scope.signal.aborted)
                error.value = cause instanceof Error ? cause.message : '更新工作区失败';
        } finally {
            if (scope === sourceScope) busy.value = false;
        }
        return error.value;
    }
    const create = (name: string, organizationId: string) =>
        mutate((signal) => source.create(name, organizationId, signal));
    const createOrganization = (name: string, workspaceName: string) => {
        const operation = source.createOrganization?.bind(source);
        return operation
            ? mutate((signal) => operation(name, workspaceName, signal))
            : Promise.resolve('组织创建尚未开放');
    };
    const join = (code: string) => {
        const operation = source.join?.bind(source);
        return operation
            ? mutate((signal) => operation(code, signal))
            : Promise.resolve('成员邀请将在后续阶段开放');
    };
    return {
        organizations,
        workspaces,
        activeId,
        current,
        organization,
        busy,
        error,
        syncError,
        syncPending,
        switching,
        canCreateOrganization,
        canJoin,
        connect,
        reset,
        load,
        initialize,
        retrySync,
        select,
        create,
        createOrganization,
        join,
    };
});
