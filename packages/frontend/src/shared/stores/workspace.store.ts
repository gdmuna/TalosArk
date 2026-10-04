import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { WorkspaceDataSource } from '@/shared/data/source';
import type { Organization, Workspace } from '@/shared/models/workspace';

export const useWorkspaceStore = defineStore('workspace-context', () => {
    const organizations = ref<Organization[]>([]);
    const workspaces = ref<Workspace[]>([]);
    const activeId = ref('');
    const busy = ref(false);
    const error = ref('');
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
        if (workspaces.value.some((item) => item.id === id)) activeId.value = id;
    }
    async function mutate(operation: () => Promise<string>) {
        if (busy.value) return '工作区正在更新';
        busy.value = true;
        error.value = '';
        try {
            const id = await operation();
            const snapshot = await source.load();
            organizations.value = snapshot.organizations;
            workspaces.value = snapshot.workspaces;
            select(id);
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
        initialize,
        select,
        create,
        join,
    };
});
