import {
    inject,
    onScopeDispose,
    ref,
    shallowRef,
    watch,
    type InjectionKey,
    type Ref,
    computed,
} from 'vue';
import { AuthenticationError, HttpError, isResponseValidationError } from '@/platform/http';
import { ZodError } from 'zod';
import { useWorkspaceStore } from '@/module/workspace';
import type { InventoryDataSource, InventoryScope } from '../data/source';

export const inventoryDataSourceKey: InjectionKey<InventoryDataSource> =
    Symbol('inventoryDataSource');
export function useInventoryDataSource() {
    return inject(inventoryDataSourceKey, null);
}

export function inventoryErrorMessage(cause: unknown) {
    if (isResponseValidationError(cause)) return '';
    if (cause instanceof ZodError) return '请检查搜索条件、数量和日期格式';
    if (
        cause instanceof AuthenticationError ||
        (cause instanceof HttpError && cause.status === 401)
    )
        return '登录会话已改变，请重新加载';
    if (!(cause instanceof HttpError))
        return cause instanceof Error ? cause.message : '库存操作失败';
    const messages: Record<string, string> = {
        INVENTORY_CONFLICT: '库存资料已改变，请重新加载后再提交',
        INVENTORY_EXPIRY_CONFIRMATION_REQUIRED: '该实物已过期，请确认风险后再提交',
        INVENTORY_CODE_CONFLICT: '实例编号已存在，请更换编号',
        INVENTORY_INVALID_INPUT: '请检查数量精度、必填资料和日期',
        INVENTORY_INVALID_STATE: '当前实物或存储状态不允许此次操作，请重新加载并核对',
        INVENTORY_CONSUMPTION_EXPIRED: '该实物已过期，不能登记正常使用消耗',
        INVENTORY_INSUFFICIENT_QUANTITY: '当前余量不足，请重新核对消耗量',
        INVENTORY_RESULT_UNAVAILABLE: '原操作回执暂不可用，请核对库存，不要另建请求重复操作',
        MATERIAL_BATCH_CONFLICT: '该材料已存在此批号，请选择已有批次',
        MATERIAL_CONFLICT: '批次资料已改变，请重新加载后再提交',
        MATERIAL_INVALID_INPUT: '生产日期不能晚于有效期，请检查批次日期',
        FACILITY_OCCUPIED: '目标位置已被占用，请重新选择空位置',
        FACILITY_CONFLICT: '存储结构已改变，请重新加载并核对位置',
        FACILITY_INVALID_STATE: '设施或位置当前不可用，请重新加载并核对',
    };
    return (
        messages[cause.code ?? ''] ??
        (cause.status === 403
            ? '当前账户无权操作此库存范围'
            : cause.status === 404
              ? '库存实例或流水不存在，或当前账户无权访问'
              : '库存服务暂不可用，请重试')
    );
}

export function useInventoryScope() {
    const workspace = useWorkspaceStore();
    return computed<InventoryScope | null>(() =>
        workspace.current
            ? {
                  organizationId: workspace.current.organizationId,
                  workspaceId: workspace.current.id,
              }
            : null
    );
}

export function useInventoryRead<T>(
    key: Ref<string>,
    read: (scope: InventoryScope, signal: AbortSignal) => Promise<T>
) {
    const source = useInventoryDataSource();
    const scope = useInventoryScope();
    const data = shallowRef<T>();
    const failure = shallowRef<unknown>();
    const loading = ref(false);
    const error = ref('');
    let request: AbortController | undefined;
    let disposed = false;
    const refresh = async () => {
        if (disposed) return false;
        request?.abort();
        const current = new AbortController();
        request = current;
        loading.value = !!key.value;
        error.value = '';
        failure.value = undefined;
        if (!source || !scope.value || !key.value) {
            data.value = undefined;
            loading.value = false;
            if (!source && key.value) error.value = '库存数据源未连接';
            return false;
        }
        try {
            const result = await read(scope.value, current.signal);
            current.signal.throwIfAborted();
            data.value = result;
            return true;
        } catch (cause) {
            if (!current.signal.aborted) {
                failure.value = cause;
                if (
                    cause instanceof AuthenticationError ||
                    (cause instanceof HttpError &&
                        (cause.kind === 'protocol' || [401, 403, 404].includes(cause.status ?? 0)))
                )
                    data.value = undefined;
                error.value = inventoryErrorMessage(cause);
            }
            return false;
        } finally {
            if (!current.signal.aborted) loading.value = false;
        }
    };
    watch(
        [key, scope],
        () => {
            data.value = undefined;
            void refresh();
        },
        { immediate: true, deep: true, flush: 'sync' }
    );
    onScopeDispose(() => {
        disposed = true;
        request?.abort();
    });
    return { data, loading, error, failure, refresh, source, scope };
}
