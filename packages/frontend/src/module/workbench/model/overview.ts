import { computed, inject, onScopeDispose, shallowReactive, watch, type InjectionKey } from 'vue';
import type { MaterialScope } from '@talos-ark/contracts/material';
import { AuthenticationError, HttpError } from '@/platform/http';
import { useWorkspaceStore } from '@/module/workspace';
import type { WorkbenchOverviewDataSource } from '../data/source';

export const workbenchOverviewDataSourceKey: InjectionKey<WorkbenchOverviewDataSource> = Symbol(
    'workbench-overview-source'
);
export type OverviewReadStatus =
    'idle' | 'loading' | 'ready' | 'forbidden' | 'error' | 'unavailable';

export function useWorkbenchOverview() {
    const source = inject(workbenchOverviewDataSourceKey, undefined);
    const workspace = useWorkspaceStore();
    const scope = computed<MaterialScope | undefined>(() => {
        const current = workspace.current;
        return current
            ? { organizationId: current.organizationId, workspaceId: current.id }
            : undefined;
    });

    function read<T>(
        load: ((scope: MaterialScope, signal: AbortSignal) => Promise<T>) | undefined
    ) {
        const state = shallowReactive({
            data: undefined as T | undefined,
            status: 'idle' as OverviewReadStatus,
            error: '',
        });
        let controller: AbortController | undefined;
        async function refresh() {
            controller?.abort();
            state.data = undefined;
            state.error = '';
            const requestedScope = scope.value;
            if (!requestedScope || !load) {
                state.status = requestedScope ? 'unavailable' : 'idle';
                return;
            }
            const request = new AbortController();
            controller = request;
            state.status = 'loading';
            try {
                const result = await load(requestedScope, request.signal);
                if (request.signal.aborted) return;
                state.data = result;
                state.status = 'ready';
            } catch (cause) {
                if (request.signal.aborted) return;
                const forbidden = cause instanceof HttpError && cause.status === 403;
                state.status = forbidden ? 'forbidden' : 'error';
                state.error = forbidden
                    ? '当前账户无权查看此工作区的数据'
                    : cause instanceof AuthenticationError ||
                        (cause instanceof HttpError && cause.status === 401)
                      ? '登录会话暂不可用，请恢复登录后重试'
                      : cause instanceof HttpError && cause.kind === 'protocol'
                        ? '返回的数据格式不正确，请重试'
                        : '暂时无法加载，请稍后重试';
            }
        }
        watch(scope, refresh, { immediate: true, flush: 'sync' });
        onScopeDispose(() => controller?.abort());
        return Object.assign(state, { refresh });
    }

    return {
        material: read(source?.material),
        inventory: read(source?.inventory),
        facilities: read(source?.facilities),
        approvalSummary: read(source?.approvalSummary),
        approvalRequests: read(source?.approvalRequests),
        scope,
    };
}
