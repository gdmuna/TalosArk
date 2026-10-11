import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
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
    const current = computed(() => workspaces.value.find((item) => item.id === activeId.value));
    const organization = computed(() =>
        organizations.value.find((item) => item.id === current.value?.organizationId)
    );

    async function initialize(dataSource: WorkspaceDataSource) {
        source = dataSource;
        const snapshot = await source.load();
        organizations.value = snapshot.organizations;
        workspaces.value = snapshot.workspaces;
        select(snapshot.activeId);
    }
    function select(id: string) {
        if (workspaces.value.some((item) => item.id === id)) {
            activeId.value = id;
            pendingSelection = undefined;
        }
    }
    async function synchronize() {
        try {
            const snapshot = await source.load();
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
            syncError.value = cause instanceof Error ? cause.message : '工作区同步失败';
        }
    }
    async function retrySync() {
        if (busy.value || !syncError.value) return;
        busy.value = true;
        try {
            await synchronize();
        } finally {
            busy.value = false;
        }
    }
    async function mutate(operation: () => Promise<string>) {
        if (busy.value) return '工作区正在更新';
        if (syncError.value) return '请先重新同步工作区';
        busy.value = true;
        error.value = '';
        try {
            pendingSelection = await operation();
            await synchronize();
        } catch (cause) {
            error.value = cause instanceof Error ? cause.message : '更新工作区失败';
        } finally {
            busy.value = false;
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
        initialize,
        retrySync,
        select,
        create,
        join,
    };
});
