import { computed, ref, shallowRef, watch, onScopeDispose } from 'vue';
import { defineStore } from 'pinia';
import type { MaterialCapabilities, MaterialType, Material } from '@talos-ark/contracts/material';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { useWorkspaceStore } from '@/module/workspace';
import type { MaterialDataSource } from '../data/source';

export function materialErrorMessage(cause: unknown, write = false): string {
    if (isResponseValidationError(cause)) return '';
    if (!(cause instanceof HttpError)) {
        if (write) return '写入结果无法确认。请先刷新并核对材料状态；确认未生效后再提交。';
        return cause instanceof Error ? cause.message : '材料操作失败';
    }
    const messages: Record<string, string> = {
        MATERIAL_CODE_CONFLICT: '当前工作区已存在此编号',
        MATERIAL_BATCH_CONFLICT: '当前材料已存在此批号，请选择已有批次或更换批号',
        MATERIAL_INVALID_INPUT: '请检查批号、日期和有效期，生产日期不能晚于有效期',
        MATERIAL_FORBIDDEN: '材料或批次不存在，或当前账户无权访问',
        MATERIAL_CLASSIFICATION_UNAVAILABLE: '请选择当前工作区内有效的材料分类',
        MATERIAL_ARCHIVED: '请先恢复材料后再编辑',
        MATERIAL_INSTANCE_LOCKED: '已有实例的材料不可更改计量单位、数量精度和业务分支',
        MATERIAL_CONFLICT: '记录已变更，请重新加载后再提交',
        TEAM_ACCESS_DENIED: '材料不存在，或当前账户无权访问',
        REQUEST_VALIDATION_FAILED: '请检查表单内容',
    };
    const knownMessage = messages[cause.code ?? ''];
    if (knownMessage) return knownMessage;
    if (
        write &&
        (cause.kind === 'network' ||
            cause.kind === 'timeout' ||
            cause.kind === 'protocol' ||
            (cause.status ?? 0) >= 500)
    )
        return '写入结果无法确认。请先刷新并核对材料状态；确认未生效后再提交。';
    return cause.kind === 'network'
        ? '无法连接服务，请检查网络后重试'
        : cause.status === 403
          ? '当前账户没有材料访问权限'
          : cause.status === 401
            ? '登录会话已失效'
            : '暂时无法完成材料操作';
}

export const useMaterialStore = defineStore('material', () => {
    const workspace = useWorkspaceStore();
    const types = ref<MaterialType[]>([]);
    const capabilities = shallowRef<MaterialCapabilities | null>(null);
    const busy = ref(false),
        error = ref('');
    const revision = ref(0);
    const failure = shallowRef<unknown>();
    let source: MaterialDataSource;
    let lifetime = new AbortController();
    const scope = computed(() =>
        workspace.current
            ? {
                  organizationId: workspace.current.organizationId,
                  workspaceId: workspace.current.id,
              }
            : null
    );
    function reset() {
        lifetime.abort();
        lifetime = new AbortController();
        types.value = [];
        capabilities.value = null;
        busy.value = false;
        error.value = '';
        failure.value = undefined;
        revision.value++;
    }
    function connect(value: MaterialDataSource) {
        reset();
        source = value;
    }
    watch(scope, reset, { flush: 'sync' });
    onScopeDispose(() => lifetime.abort());
    function context() {
        if (!scope.value || !source) throw new Error('没有可用的工作区');
        return { source, scope: { ...scope.value }, signal: lifetime.signal };
    }
    async function loadTypes() {
        const current = context();
        const result = await current.source.types(current.scope, current.signal);
        current.signal.throwIfAborted();
        types.value = result.items;
        capabilities.value = result.capabilities;
    }
    async function mutate<T>(
        operation: (current: ReturnType<typeof context>) => Promise<T>
    ): Promise<T | undefined> {
        if (busy.value) return;
        if (!scope.value) {
            error.value = '没有可用的工作区';
            return;
        }
        const current = context();
        busy.value = true;
        error.value = '';
        failure.value = undefined;
        try {
            const result = await operation(current);
            current.signal.throwIfAborted();
            revision.value++;
            return result;
        } catch (cause) {
            if (!current.signal.aborted) {
                failure.value = cause;
                error.value = materialErrorMessage(cause, true);
            }
            return;
        } finally {
            if (!current.signal.aborted) busy.value = false;
        }
    }
    function archive(material: Material) {
        return mutate(({ source, scope, signal }) =>
            source.archive(scope, material.id, !material.archivedAt, signal)
        );
    }
    return {
        types,
        capabilities,
        busy,
        error,
        revision,
        failure,
        scope,
        connect,
        reset,
        context,
        loadTypes,
        mutate,
        archive,
    };
});
