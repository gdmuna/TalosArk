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
import { AuthenticationError, HttpError } from '@/platform/http';
import {
    deploymentInformationSchema,
    type DeploymentInformationDataSource,
    type DeploymentInformation,
} from '../data/source';

export const deploymentInformationDataSourceKey: InjectionKey<DeploymentInformationDataSource> =
    Symbol('deploymentInformation');
export function useDeploymentInformation(
    context: Ref<{ accountId: string; organizationId: string } | null>
) {
    const source = inject(deploymentInformationDataSourceKey, null);
    const key = computed(() => (source && context.value ? JSON.stringify(context.value) : ''));
    const data = shallowRef<DeploymentInformation>();
    const loading = ref(false);
    const error = ref('');
    let request: AbortController | undefined;
    async function refresh() {
        request?.abort();
        const current = new AbortController();
        request = current;
        const selected = context.value;
        loading.value = !!source && !!selected;
        error.value = '';
        if (!source || !selected) {
            data.value = undefined;
            return;
        }
        try {
            const response = await source.read(selected.organizationId, current.signal);
            if (current.signal.aborted) return;
            const parsed = deploymentInformationSchema.safeParse(response);
            if (!parsed.success || parsed.data.organizationId !== selected.organizationId)
                throw new HttpError('部署信息响应无效', 'protocol');
            data.value = parsed.data;
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
                  ? '当前账户无权查看部署信息'
                  : status === 404
                    ? '部署信息已不可访问'
                    : protocol
                      ? ''
                      : '部署信息读取失败，请重试';
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
    return { available: !!source, data, loading, error, refresh };
}
