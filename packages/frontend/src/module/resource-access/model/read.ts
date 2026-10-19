import { inject, onScopeDispose, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue';
import { AuthenticationError, HttpError } from '@/platform/http';
import type {
    AccessScope,
    ResourceAccessDataSource,
    ResourceGrant,
    SharingPolicyDataSource,
} from '../data/source';

export const resourceAccessDataSourceKey: InjectionKey<ResourceAccessDataSource> = Symbol(
    'resourceAccessDataSource'
);
export const sharingPolicyDataSourceKey: InjectionKey<SharingPolicyDataSource> =
    Symbol('sharingPolicyDataSource');
export const useResourceAccessDataSource = () => inject(resourceAccessDataSourceKey, null);
export const useSharingPolicyDataSource = () => inject(sharingPolicyDataSourceKey, null);

export function assertAccessScope(
    scope: AccessScope,
    organizationId: string,
    workspaceId?: string
) {
    if (
        organizationId !== scope.organizationId ||
        (scope.workspaceId && scope.workspaceId !== workspaceId)
    )
        throw new HttpError('授权响应范围不匹配', 'protocol');
}

export function assertGrantScope(scope: AccessScope, grant: ResourceGrant, resourceId?: string) {
    assertAccessScope(scope, grant.organizationId, grant.resource.workspace.id);
    if (resourceId && grant.resource.id !== resourceId)
        throw new HttpError('授权响应资源不匹配', 'protocol');
}

export function useResourceAccessRead<T>(
    key: Ref<string>,
    read: (signal: AbortSignal) => Promise<T>
) {
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
        if (!key.value) {
            data.value = undefined;
            return;
        }
        try {
            const next = await read(current.signal);
            if (!current.signal.aborted) data.value = next;
        } catch (cause) {
            if (current.signal.aborted) return;
            const status = cause instanceof HttpError ? cause.status : undefined;
            const authentication = cause instanceof AuthenticationError || status === 401;
            const protocol = cause instanceof HttpError && cause.kind === 'protocol';
            if (authentication || protocol || status === 403 || status === 404)
                data.value = undefined;
            error.value = authentication
                ? '登录会话已改变，请重新加载'
                : status === 403
                  ? '当前账户无权查看此范围'
                  : status === 404
                    ? '记录不存在或已不可访问'
                    : protocol
                      ? '响应信息不一致，请重新加载'
                      : '读取失败，请重试';
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
