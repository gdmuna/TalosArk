import { computed, onScopeDispose, ref } from 'vue';
import { defineStore } from 'pinia';
import { createTaskScope, waitFor } from '@/platform/task';
import type { WorkspaceDataSource } from '../data/source';
import type { Organization, Workspace } from './workspace';

export const useWorkspaceStore = defineStore('workspace-context', () => {
    const organizations = ref<Organization[]>([]);
    const workspaces = ref<Workspace[]>([]);
    const activeId = ref('');
    const busy = ref(false);
    const error = ref('');
    const syncError = ref('');
    let pendingSelection: string | undefined;
    let source: WorkspaceDataSource;
    let sourceScope = createTaskScope([]);
    onScopeDispose(() => sourceScope.dispose());
    const current = computed(() => workspaces.value.find((item) => item.id === activeId.value));
    const organization = computed(() =>
        organizations.value.find((item) => item.id === current.value?.organizationId)
    );

    function connect(dataSource: WorkspaceDataSource) {
        sourceScope.dispose();
        sourceScope = createTaskScope([]);
        source = dataSource;
    }
    function reset() {
        sourceScope.dispose();
        sourceScope = createTaskScope([]);
        organizations.value = [];
        workspaces.value = [];
        activeId.value = '';
        pendingSelection = undefined;
        busy.value = false;
        error.value = syncError.value = '';
    }
    async function load(signal?: AbortSignal) {
        const task = createTaskScope([sourceScope.signal, signal]);
        try {
            task.signal.throwIfAborted();
            const snapshot = await waitFor(source.load(task.signal), task.signal);
            task.signal.throwIfAborted();
            organizations.value = snapshot.organizations;
            workspaces.value = snapshot.workspaces;
            select(snapshot.activeId);
        } finally {
            task.dispose();
        }
    }
    async function initialize(dataSource: WorkspaceDataSource) {
        connect(dataSource);
        await load();
    }
    function select(id: string) {
        if (workspaces.value.some((item) => item.id === id)) {
            activeId.value = id;
            pendingSelection = undefined;
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
                throw new Error('新工作区尚未出现在同步结果中，请重新同步');
            }
            organizations.value = snapshot.organizations;
            workspaces.value = snapshot.workspaces;
            select(pendingSelection ?? activeId.value);
            syncError.value = '';
        } catch (cause) {
            if (!scope.signal.aborted)
                syncError.value = cause instanceof Error ? cause.message : '工作区同步失败';
        }
    }
    async function retrySync() {
        if (busy.value || !syncError.value) return;
        busy.value = true;
        const scope = sourceScope;
        try {
            await synchronize();
        } finally {
            if (scope === sourceScope) busy.value = false;
        }
    }
    async function mutate(operation: () => Promise<string>) {
        if (busy.value) return '工作区正在更新';
        if (syncError.value) return '请先重新同步工作区';
        busy.value = true;
        error.value = '';
        const scope = sourceScope;
        try {
            const selection = await operation();
            scope.signal.throwIfAborted();
            pendingSelection = selection;
            await synchronize();
        } catch (cause) {
            if (!scope.signal.aborted)
                error.value = cause instanceof Error ? cause.message : '更新工作区失败';
        } finally {
            if (scope === sourceScope) busy.value = false;
        }
        return error.value;
    }
    const create = (name: string, organizationId: string) =>
        mutate(() => source.create(name, organizationId));
    const join = (code: string) => mutate(() => source.join(code));
    return {
        organizations,
        workspaces,
        activeId,
        current,
        organization,
        busy,
        error,
        syncError,
        connect,
        reset,
        load,
        initialize,
        retrySync,
        select,
        create,
        join,
    };
});
