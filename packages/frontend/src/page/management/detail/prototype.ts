import { reactive, ref, shallowRef, watch, onScopeDispose, type Ref } from 'vue';
import {
    createManagementDetailMock,
    createTeamManagementState,
    ManagementDetailUnavailableError,
    type ManagementDetailSource,
    type DetailCatalog,
    type TeamManagementContext,
} from '@/module/workspace/prototype';
export type {
    WorkspaceDetail,
    MemberDetail,
    RoleDetail,
    DetailCatalog,
    DetailActivity,
    DetailResource,
    DetailFacilityAccess,
} from '@/module/workspace/prototype';

let prototype: ManagementDetailSource | undefined;
export const prototypeEntry = {
    workspace: '/main/management/workspace/019a0000-0000-7000-8000-000000000011',
    member: '/main/management/member/019a0000-0000-7000-8000-000000000102?organization=019a0000-0000-7000-8000-000000000001',
    role: '/main/management/role/019a0000-0000-7000-8000-000000000033?organization=019a0000-0000-7000-8000-000000000001',
};
export const detailDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
export const memberStatus = (value: string) =>
    ({ ACTIVE: '有效', SUSPENDED: '已暂停', LEFT: '已离开' })[
        value as 'ACTIVE' | 'SUSPENDED' | 'LEFT'
    ] ?? value;

export function usePrototypeObject<T>(
    key: Ref<string>,
    read: (source: ManagementDetailSource, signal: AbortSignal) => Promise<T>
) {
    const source = (prototype ??= createManagementDetailMock());
    const data = shallowRef<T>();
    const catalog = shallowRef<DetailCatalog>();
    const loading = ref(false),
        busy = ref(false),
        error = ref(''),
        syncError = ref('');
    let controller = new AbortController(),
        generation = 0;
    async function refresh() {
        const current = generation,
            signal = controller.signal;
        loading.value = true;
        error.value = '';
        try {
            const nextCatalog = await source.catalog(signal);
            const next = await read(source, signal);
            if (signal.aborted || current !== generation) return;
            catalog.value = nextCatalog;
            data.value = next;
            syncError.value = '';
        } catch (cause) {
            if (!signal.aborted && current === generation) {
                if (cause instanceof ManagementDetailUnavailableError) data.value = undefined;
                error.value = cause instanceof Error ? cause.message : '读取失败';
            }
        } finally {
            if (current === generation) loading.value = false;
        }
    }
    watch(
        key,
        () => {
            controller.abort();
            controller = new AbortController();
            generation++;
            data.value = undefined;
            catalog.value = undefined;
            busy.value = false;
            syncError.value = '';
            void refresh();
        },
        { immediate: true, flush: 'sync' }
    );
    async function write(
        action: (source: ManagementDetailSource, signal: AbortSignal) => Promise<unknown>
    ) {
        if (busy.value || loading.value || syncError.value) return false;
        const current = generation,
            signal = controller.signal;
        busy.value = true;
        error.value = '';
        try {
            await action(source, signal);
            if (signal.aborted || current !== generation) return false;
            await refresh();
            if (signal.aborted || current !== generation) return false;
            if (error.value) syncError.value = '模拟变更已保存，但视图未同步。请仅重新加载。';
            return true;
        } catch (cause) {
            if (!signal.aborted && current === generation)
                error.value = cause instanceof Error ? cause.message : '保存失败';
            return false;
        } finally {
            if (current === generation) busy.value = false;
        }
    }
    onScopeDispose(() => {
        controller.abort();
        generation++;
    });
    return { source, data, catalog, loading, busy, error, syncError, refresh, write };
}

export function usePrototypeTeam(
    catalog: Ref<DetailCatalog | undefined>,
    source: ManagementDetailSource
) {
    const model = reactive(createTeamManagementState({ activeId: '', load: async () => {} }));
    model.connect(source.team);
    const contextCatalog: TeamManagementContext['catalog'] = reactive({
        organizations: [],
        workspaces: [],
    });
    watch(
        catalog,
        (value) => {
            contextCatalog.organizations = value?.organizations ?? [];
            contextCatalog.workspaces = value?.workspaces.filter((item) => !item.archivedAt) ?? [];
        },
        { immediate: true }
    );
    return { model, contextCatalog };
}
