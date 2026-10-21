import { inject, onScopeDispose, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue';
import { AuthenticationError, HttpError, isResponseValidationError } from '@/platform/http';
import type { FacilityDataSource, FacilityGovernanceDataSource } from '../data/source';

export const facilityDataSourceKey: InjectionKey<FacilityDataSource> = Symbol('facilityDataSource');
export const facilityGovernanceDataSourceKey: InjectionKey<FacilityGovernanceDataSource> = Symbol(
    'facilityGovernanceDataSource'
);
export const useFacilityDataSource = () => inject(facilityDataSourceKey, null);
export const useFacilityGovernanceDataSource = () => inject(facilityGovernanceDataSourceKey, null);

export function useFacilityRead<T>(key: Ref<string>, read: (signal: AbortSignal) => Promise<T>) {
    const data = shallowRef<T>();
    const loading = ref(false);
    const error = ref('');
    const busy = ref(false);
    const conflict = ref(false);
    const syncError = ref('');
    const pendingSync = ref(false);
    let lifetime = new AbortController();
    let request: AbortController | undefined;
    async function refresh() {
        request?.abort();
        const current = new AbortController();
        request = current;
        loading.value = !!key.value;
        error.value = '';
        if (!key.value) {
            data.value = undefined;
            return false;
        }
        try {
            const result = await read(current.signal);
            if (current.signal.aborted) return false;
            data.value = result;
            pendingSync.value = false;
            conflict.value = false;
            syncError.value = '';
            return true;
        } catch (cause) {
            if (current.signal.aborted) return false;
            const status = cause instanceof HttpError ? cause.status : undefined;
            const authentication = cause instanceof AuthenticationError || status === 401;
            const protocol =
                cause instanceof HttpError &&
                (cause.kind === 'protocol' || cause.code === 'FACILITY_INVALID_CURSOR');
            if (authentication || protocol || status === 403 || status === 404)
                data.value = undefined;
            error.value = facilityErrorMessage(cause);
            if (pendingSync.value)
                syncError.value = isResponseValidationError(cause)
                    ? ''
                    : '操作已成功，但数据尚未同步。请仅重新加载，不要重复提交。';
            return false;
        } finally {
            if (!current.signal.aborted) loading.value = false;
        }
    }
    watch(
        key,
        () => {
            lifetime.abort();
            lifetime = new AbortController();
            busy.value = conflict.value = pendingSync.value = false;
            syncError.value = '';
            data.value = undefined;
            void refresh();
        },
        { immediate: true, flush: 'sync' }
    );
    async function write(action: (signal: AbortSignal) => Promise<unknown>) {
        if (!key.value || busy.value || loading.value || pendingSync.value || conflict.value)
            return false;
        const signal = lifetime.signal;
        busy.value = true;
        error.value = '';
        try {
            await action(signal);
            if (signal.aborted) return false;
            pendingSync.value = true;
            await refresh();
            return !signal.aborted;
        } catch (cause) {
            if (signal.aborted) return false;
            conflict.value = cause instanceof HttpError && cause.status === 409;
            if (
                cause instanceof AuthenticationError ||
                (cause instanceof HttpError &&
                    (cause.kind === 'protocol' || [401, 403, 404].includes(cause.status ?? 0)))
            )
                data.value = undefined;
            error.value = facilityErrorMessage(cause, true);
            return false;
        } finally {
            if (!signal.aborted) busy.value = false;
        }
    }
    onScopeDispose(() => {
        lifetime.abort();
        request?.abort();
    });
    return { data, loading, error, refresh, busy, conflict, syncError, pendingSync, write };
}

export function facilityErrorMessage(cause: unknown, write = false) {
    if (isResponseValidationError(cause)) return '';
    if (
        cause instanceof AuthenticationError ||
        (cause instanceof HttpError && cause.status === 401)
    )
        return '登录会话已改变，请重新加载';
    if (!(cause instanceof HttpError))
        return write
            ? '写入结果无法确认。请先重新加载并检查数据；确认未生效后再提交。'
            : '操作失败，请重试';
    const message: Record<string, string> = {
        FACILITY_CONFLICT: '设施或布局已改变。请重新加载后确认草稿，再提交。',
        FACILITY_CODE_CONFLICT: '编号或坐标已被使用。请重新加载后调整草稿。',
        FACILITY_INVALID_INPUT: '结构或坐标无效，请检查父级、网格规格和必填字段。',
        FACILITY_INVALID_CURSOR: '布局或查询已改变，请重新加载首批节点。',
        FACILITY_OCCUPIED: '结构中存在库存，请先处理存量；本阶段仅支持空子树维护。',
        FACILITY_INVALID_STATE: '当前状态不允许此操作，请检查设施、父级及子节点状态。',
    };
    const knownMessage = message[cause.code ?? ''];
    if (knownMessage) return knownMessage;
    if (
        write &&
        (cause.kind === 'network' ||
            cause.kind === 'timeout' ||
            cause.kind === 'protocol' ||
            (cause.status ?? 0) >= 500)
    )
        return '写入结果无法确认。请先重新加载并检查数据；确认未生效后再提交。';
    return cause.status === 403
        ? '当前账户无权操作此范围'
        : cause.status === 404
          ? '设施或节点不存在或已不可访问'
          : cause.status === 409
            ? '数据已改变，请重新加载后确认草稿'
            : '服务暂不可用，请重试';
}
