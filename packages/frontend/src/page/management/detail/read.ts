import { onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue';
import type { ManagementActivityPage } from '@talos-ark/contracts/team';
import { useAccountStore } from '@/module/account';
import { teamErrorMessage } from '@/module/workspace';
import { HttpError } from '@/platform/http';

export const detailDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
export const memberStatus = (value: string) =>
    (({ ACTIVE: '有效', SUSPENDED: '已暂停', LEFT: '已离开' }) as Record<string, string>)[value] ??
    value;

export function useDetailRead<T>(
    key: Ref<string>,
    read: (signal: AbortSignal) => Promise<T>,
    synchronize?: (signal: AbortSignal) => Promise<void>
) {
    const account = useAccountStore();
    const data = shallowRef<T>();
    const readError = shallowRef<unknown>();
    const loading = ref(false),
        busy = ref(false),
        error = ref(''),
        syncError = ref('');
    let lifetime = new AbortController(),
        request: AbortController | undefined;
    let generation = 0,
        readVersion = 0,
        pendingSync = false;

    async function refresh() {
        request?.abort();
        request = new AbortController();
        const signal = AbortSignal.any([lifetime.signal, request.signal]);
        const current = generation,
            version = ++readVersion;
        loading.value = true;
        error.value = '';
        readError.value = undefined;
        try {
            if (pendingSync) await synchronize?.(signal);
            const next = key.value ? await read(signal) : undefined;
            if (signal.aborted || current !== generation || version !== readVersion) return false;
            data.value = next;
            pendingSync = false;
            syncError.value = '';
            return true;
        } catch (cause) {
            if (!signal.aborted && current === generation && version === readVersion) {
                if (cause instanceof HttpError && [401, 403, 404].includes(cause.status ?? 0))
                    data.value = undefined;
                readError.value = cause;
                error.value = teamErrorMessage(cause);
                if (pendingSync)
                    syncError.value = '变更已保存，但视图尚未同步。请重新加载，不要重复提交。';
            }
            return false;
        } finally {
            if (current === generation && version === readVersion) loading.value = false;
        }
    }
    watch(
        [key, () => account.profile?.id],
        () => {
            lifetime.abort();
            lifetime = new AbortController();
            generation++;
            data.value = undefined;
            busy.value = pendingSync = false;
            syncError.value = '';
            void refresh();
        },
        { immediate: true, flush: 'sync' }
    );

    async function write(action: (signal: AbortSignal) => Promise<unknown>) {
        if (busy.value || loading.value || pendingSync || !key.value) return false;
        const current = generation,
            signal = lifetime.signal;
        busy.value = true;
        error.value = '';
        try {
            await action(signal);
            if (signal.aborted || current !== generation) return false;
            pendingSync = true;
            await refresh();
            return !signal.aborted && current === generation;
        } catch (cause) {
            if (!signal.aborted && current === generation) error.value = teamErrorMessage(cause);
            return false;
        } finally {
            if (current === generation) busy.value = false;
        }
    }
    onScopeDispose(() => {
        lifetime.abort();
        request?.abort();
        generation++;
    });
    return { data, loading, busy, error, readError, syncError, refresh, write };
}

export function useDetailActivity(
    key: Ref<string>,
    read: (cursor: string | undefined, signal: AbortSignal) => Promise<ManagementActivityPage>
) {
    const account = useAccountStore();
    const cursor = ref<string>();
    const items = shallowRef<ManagementActivityPage['items']>([]);
    const nextCursor = ref<string | null>(null);
    watch(
        [key, () => account.profile?.id],
        () => {
            cursor.value = undefined;
            items.value = [];
            nextCursor.value = null;
        },
        { flush: 'sync' }
    );
    const result = useDetailRead(key, (signal) => read(cursor.value, signal));
    watch(
        result.readError,
        (cause) => {
            if (cause instanceof HttpError && [401, 403, 404].includes(cause.status ?? 0)) {
                cursor.value = undefined;
                items.value = [];
                nextCursor.value = null;
            }
        },
        { flush: 'sync' }
    );
    watch(result.data, (value) => {
        if (!value) return;
        items.value = cursor.value
            ? [
                  ...items.value,
                  ...value.items.filter(
                      (item) => !items.value.some((existing) => existing.id === item.id)
                  ),
              ]
            : value.items;
        nextCursor.value = value.nextCursor;
    });
    function refresh() {
        cursor.value = undefined;
        items.value = [];
        nextCursor.value = null;
        result.data.value = undefined;
        return result.refresh();
    }
    return {
        ...result,
        refresh,
        items,
        nextCursor,
        more: () => {
            if (!result.loading.value && nextCursor.value) {
                cursor.value = nextCursor.value;
                void result.refresh();
            }
        },
    };
}
