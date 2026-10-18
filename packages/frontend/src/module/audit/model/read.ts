import { inject, onScopeDispose, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue';
import { AuthenticationError, HttpError } from '@/platform/http';
import type { AuditDataSource, AuditRecord, AuditScope } from '../data/source';

export const auditDataSourceKey: InjectionKey<AuditDataSource> = Symbol('auditDataSource');
export const useAuditDataSource = () => inject(auditDataSourceKey, null);

export function assertAuditScope(scope: AuditScope, records: AuditRecord[]) {
    if (
        records.some(
            (record) =>
                record.organization.id !== scope.organizationId ||
                (scope.workspaceId && record.workspace?.id !== scope.workspaceId)
        )
    )
        throw new HttpError('审计响应范围不匹配', 'protocol');
}

export function useAuditRead<T>(key: Ref<string>, read: (signal: AbortSignal) => Promise<T>) {
    const data = shallowRef<T>();
    const loading = ref(false);
    const error = ref('');
    let request: AbortController | undefined;

    async function refresh() {
        request?.abort();
        const current = new AbortController();
        request = current;
        loading.value = !!key.value;
        error.value = '';
        if (!key.value) return;
        try {
            const result = await read(current.signal);
            if (!current.signal.aborted) data.value = result;
        } catch (cause) {
            if (current.signal.aborted) return;
            const status = cause instanceof HttpError ? cause.status : undefined;
            if (
                cause instanceof AuthenticationError ||
                (cause instanceof HttpError && cause.kind === 'protocol') ||
                [401, 403, 404].includes(status ?? 0)
            )
                data.value = undefined;
            error.value =
                status === 403
                    ? '当前账户无权查看此范围的审计记录'
                    : status === 404
                      ? '审计记录不存在或已不可访问'
                      : status === 401 || cause instanceof AuthenticationError
                        ? '登录会话已改变，请重新加载'
                        : status === 400
                          ? '筛选条件或游标已失效，请返回首批重新查询'
                          : '审计记录加载失败，请重试';
        } finally {
            if (!current.signal.aborted) loading.value = false;
        }
    }

    watch(
        key,
        () => {
            data.value = undefined;
            void refresh();
        },
        { immediate: true, flush: 'sync' }
    );
    onScopeDispose(() => request?.abort());
    return { data, loading, error, refresh };
}
