import { computed, watch } from 'vue';
import { useRoute, useRouter, type LocationQuery } from 'vue-router';
import { useWorkspaceStore } from '@/module/workspace';
import type { TeamManagementListState } from '@/module/workspace/ui';

export function useTeamListQuery(view: 'members' | 'roles') {
    const route = useRoute(),
        router = useRouter(),
        workspace = useWorkspaceStore();
    const path = route.path;
    const text = (query: LocationQuery, key: string) =>
        typeof query[key] === 'string' ? query[key] : '';
    const state = computed<TeamManagementListState>((previous) => {
        if (route.path !== path && previous) return previous;
        const query = route.query;
        const organizationId = workspace.organizations.some(
            (item) => item.id === text(query, 'organization')
        )
            ? text(query, 'organization')
            : (workspace.organization?.id ?? workspace.organizations[0]?.id ?? '');
        const workspaceId = workspace.workspaces.find(
            (item) => item.organizationId === organizationId && item.id === text(query, 'workspace')
        )?.id;
        const requestedPage = Number(text(query, 'page'));
        const requestedSize = Number(text(query, 'pageSize'));
        const scope = text(query, 'scope');
        return {
            organizationId,
            workspaceId,
            tab:
                view === 'members' && text(query, 'tab') === 'invitations'
                    ? 'invitations'
                    : 'members',
            search: view === 'members' ? text(query, 'q').trim().slice(0, 100) : text(query, 'q'),
            page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
            pageSize: [20, 50, 100].includes(requestedSize) ? requestedSize : 20,
            roleFilter: scope === 'ORGANIZATION' || scope === 'WORKSPACE' ? scope : 'all',
            roleView: text(query, 'view') === 'matrix' ? 'matrix' : 'list',
        };
    });
    function update(next: TeamManagementListState) {
        if (route.path !== path) return;
        const query = {
            ...route.query,
            organization: next.organizationId || undefined,
            workspace: next.workspaceId,
            q: next.search || undefined,
            ...(view === 'members'
                ? {
                      tab: next.tab === 'members' ? undefined : next.tab,
                      page: next.page === 1 ? undefined : String(next.page),
                      pageSize: next.pageSize === 20 ? undefined : String(next.pageSize),
                  }
                : {
                      scope: next.roleFilter === 'all' ? undefined : next.roleFilter,
                      view: next.roleView === 'list' ? undefined : next.roleView,
                  }),
        };
        if (router.resolve({ path, query, hash: route.hash }).fullPath !== route.fullPath)
            return router.replace({ path, query, hash: route.hash });
    }
    watch(state, (value) => void update(value), { immediate: true });
    return { state, update };
}
