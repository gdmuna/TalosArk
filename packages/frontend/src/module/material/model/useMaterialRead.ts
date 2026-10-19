import { onScopeDispose, ref, shallowRef, watch, type WatchSource } from 'vue';
import { useMaterialStore, materialErrorMessage } from './store';
import { AuthenticationError, HttpError } from '@/platform/http';

export function useMaterialRead<T>(
    load: (
        context: ReturnType<ReturnType<typeof useMaterialStore>['context']>,
        signal: AbortSignal
    ) => Promise<T>,
    dependencies: WatchSource[] = []
) {
    const store = useMaterialStore();
    const data = shallowRef<T>();
    const loading = ref(false),
        error = ref('');
    let controller: AbortController | undefined;
    let disposed = false;
    let pending: Promise<boolean> | undefined;
    function start() {
        const current = run();
        pending = current;
        void current.finally(() => {
            if (pending === current) pending = undefined;
        });
        return current;
    }
    async function run() {
        if (disposed) return false;
        controller?.abort();
        controller = new AbortController();
        const currentController = controller;
        error.value = '';
        loading.value = false;
        if (!store.scope) {
            data.value = undefined;
            return false;
        }
        let signal = currentController.signal;
        loading.value = true;
        try {
            const context = store.context();
            signal = AbortSignal.any([context.signal, currentController.signal]);
            const result = await load(context, signal);
            signal.throwIfAborted();
            data.value = result;
            return true;
        } catch (cause) {
            if (!signal.aborted) {
                if (
                    cause instanceof AuthenticationError ||
                    (cause instanceof HttpError &&
                        (cause.kind === 'protocol' || [401, 403, 404].includes(cause.status ?? 0)))
                )
                    data.value = undefined;
                error.value = materialErrorMessage(cause);
            }
            return false;
        } finally {
            if (!currentController.signal.aborted) loading.value = false;
        }
    }
    watch(
        [() => store.scope, ...dependencies],
        () => {
            data.value = undefined;
            void start();
        },
        {
            immediate: true,
            deep: true,
            flush: 'sync',
        }
    );
    watch(
        () => store.revision,
        () => void start(),
        { flush: 'sync' }
    );
    onScopeDispose(() => {
        disposed = true;
        controller?.abort();
    });
    return {
        data,
        loading,
        error,
        reload: () => pending ?? start(),
    };
}
