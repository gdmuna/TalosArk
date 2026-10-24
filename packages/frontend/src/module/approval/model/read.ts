import {
    computed,
    inject,
    onScopeDispose,
    ref,
    shallowRef,
    watch,
    type InjectionKey,
    type Ref,
} from 'vue';
import type { ApprovalScope } from '@talos-ark/contracts/approval';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { useWorkspaceStore } from '@/module/workspace';
import { useAccountStore } from '@/module/account';
import { inventoryErrorMessage } from '@/module/inventory';
import type { ApprovalDataSource } from '../data/source';
export const approvalDataSourceKey: InjectionKey<ApprovalDataSource> = Symbol('approval-source');
export function useApprovalDataSource() {
    return inject(approvalDataSourceKey, null);
}
export function useApprovalScope() {
    const workspace = useWorkspaceStore();
    return computed<ApprovalScope | null>(() =>
        workspace.current
            ? {
                  organizationId: workspace.current.organizationId,
                  workspaceId: workspace.current.id,
              }
            : null
    );
}
export function approvalErrorMessage(cause: unknown) {
    if (isResponseValidationError(cause)) return '';
    const messages: Record<string, string> = {
        APPROVAL_FORBIDDEN: '当前账户无权处理此申请或相关资源',
        APPROVAL_INVALID_INPUT: '请检查全部明细、数量、目标位置与审批结论',
        APPROVAL_CONFLICT: '申请已改变，请重新加载后操作',
        APPROVAL_INVALID_STATE: '该操作已结束或当前状态不允许操作',
        APPROVAL_BINDING_CHANGED: '当前位置或治理设施与获批范围不一致，恢复原范围后可重试',
        APPROVAL_RESULT_UNAVAILABLE: '原操作结果暂不可用，请继续核对原请求',
    };
    if (!(cause instanceof HttpError)) return inventoryErrorMessage(cause);
    if (cause.code && messages[cause.code]) return messages[cause.code];
    if (cause.code && /^(INVENTORY|MATERIAL|FACILITY)_/.test(cause.code))
        return inventoryErrorMessage(cause);
    if (cause.status === 401) return '登录会话已改变，请重新加载';
    if (cause.status === 403) return '当前账户无权访问此申请范围';
    if (cause.status === 404) return '申请不存在，或当前账户无权访问';
    return '审批服务暂不可用，请重试';
}
export function useApprovalRead<T>(
    key: Ref<string>,
    load: (source: ApprovalDataSource, scope: ApprovalScope, signal: AbortSignal) => Promise<T>
) {
    const source = useApprovalDataSource(),
        scope = useApprovalScope(),
        account = useAccountStore();
    const data = shallowRef<T>(),
        failure = shallowRef<unknown>(),
        error = ref(''),
        loading = ref(false);
    let request: AbortController | undefined,
        disposed = false;
    async function refresh() {
        if (disposed) return false;
        request?.abort();
        const controller = new AbortController();
        request = controller;
        error.value = '';
        failure.value = undefined;
        loading.value = false;
        const current = scope.value;
        if (!source || !current || !key.value || !account.profile) {
            data.value = undefined;
            return false;
        }
        loading.value = true;
        try {
            const result = await load(source, current, controller.signal);
            if (controller.signal.aborted) return false;
            data.value = result;
            return true;
        } catch (cause) {
            if (controller.signal.aborted) return false;
            failure.value = cause;
            data.value = undefined;
            error.value = approvalErrorMessage(cause);
            return false;
        } finally {
            if (!controller.signal.aborted) loading.value = false;
        }
    }
    watch(
        [key, scope, () => account.profile?.id],
        () => {
            data.value = undefined;
            void refresh();
        },
        { immediate: true, flush: 'sync' }
    );
    onScopeDispose(() => {
        disposed = true;
        request?.abort();
    });
    return { data, loading, error, failure, refresh, scope, source };
}
