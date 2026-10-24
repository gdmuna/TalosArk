import { inject, onScopeDispose, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue';
import { ZodError } from 'zod';
import { AuthenticationError, HttpError } from '@/platform/http';
import {
    integrationCatalogSchema,
    integrationDetailSchema,
    integrationLogPageSchema,
    type IntegrationDataSource,
    type IntegrationLogQuery,
} from '../data/source';

export const integrationDataSourceKey: InjectionKey<IntegrationDataSource> =
    Symbol('integrationDataSource');
export const useIntegrationDataSource = () => inject(integrationDataSourceKey, null);

export function readIntegrationCatalog(organizationId: string, value: unknown) {
    const result = integrationCatalogSchema.parse(value);
    if (result.organizationId !== organizationId)
        throw new HttpError('集成响应范围不一致', 'protocol');
    return result;
}
export function readIntegrationDetail(
    organizationId: string,
    integrationId: string,
    value: unknown
) {
    const result = integrationDetailSchema.parse(value);
    if (result.organizationId !== organizationId || result.id !== integrationId)
        throw new HttpError('集成响应身份不一致', 'protocol');
    return result;
}
export function readIntegrationLogPage(
    organizationId: string,
    integrationId: string,
    query: IntegrationLogQuery,
    value: unknown
) {
    const result = integrationLogPageSchema.parse(value);
    if (
        result.organizationId !== organizationId ||
        result.integrationId !== integrationId ||
        result.kind !== query.kind ||
        result.cursor !== query.cursor ||
        result.items.length > query.limit ||
        (result.nextCursor !== null && result.nextCursor === query.cursor)
    )
        throw new HttpError('集成日志响应范围不一致', 'protocol');
    return result;
}

export function useIntegrationRead<T>(key: Ref<string>, read: (signal: AbortSignal) => Promise<T>) {
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
            const result = await read(current.signal);
            if (!current.signal.aborted) data.value = result;
        } catch (cause) {
            if (current.signal.aborted) return;
            const status = cause instanceof HttpError ? cause.status : undefined;
            const authentication = cause instanceof AuthenticationError || status === 401;
            const protocol =
                cause instanceof ZodError ||
                (cause instanceof HttpError && cause.kind === 'protocol');
            if (authentication || protocol || status === 403 || status === 404)
                data.value = undefined;
            error.value = authentication
                ? '登录会话已改变，请重新加载'
                : status === 403
                  ? '当前账户无权查看此集成信息'
                  : status === 404
                    ? '集成不存在或已不可访问'
                    : protocol
                      ? ''
                      : '集成信息读取失败，请重试';
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
