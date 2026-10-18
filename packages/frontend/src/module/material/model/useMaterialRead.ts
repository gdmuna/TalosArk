import { ref, shallowRef, watch, type WatchSource } from 'vue';
import { useMaterialStore, materialErrorMessage } from './store';

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
        error = ref(''),
        version = ref(0);
    watch(
        [() => store.scope, () => store.revision, version, ...dependencies],
        async (_, __, onCleanup) => {
            const controller = new AbortController();
            onCleanup(() => controller.abort());
            data.value = undefined;
            error.value = '';
            loading.value = false;
            if (!store.scope) return;
            const context = store.context();
            const signal = AbortSignal.any([context.signal, controller.signal]);
            loading.value = true;
            try {
                const result = await load(context, signal);
                signal.throwIfAborted();
                data.value = result;
            } catch (cause) {
                if (!signal.aborted) error.value = materialErrorMessage(cause);
            } finally {
                if (!controller.signal.aborted) loading.value = false;
            }
        },
        { immediate: true, deep: true }
    );
    return {
        data,
        loading,
        error,
        reload: () => {
            version.value++;
        },
    };
}
