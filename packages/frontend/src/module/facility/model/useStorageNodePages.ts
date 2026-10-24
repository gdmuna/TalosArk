import { shallowRef, watch, type Ref } from 'vue';
import { HttpError } from '@/platform/http';
import type { StorageNodePage } from '../data/source';
import { useFacilityRead } from './read';

export function useStorageNodePages(
    key: Ref<string>,
    load: (cursor: string | undefined, signal: AbortSignal) => Promise<StorageNodePage | undefined>
) {
    let cursor: string | undefined;
    const accepted = shallowRef<StorageNodePage>();
    watch(key, () => (cursor = undefined), { flush: 'sync' });
    const reader = useFacilityRead<StorageNodePage | undefined>(key, async (signal) => {
        const requestedCursor = cursor;
        const result = await load(requestedCursor, signal);
        if (signal.aborted || !result) return;
        const snapshot = accepted.value;
        const items = [...(requestedCursor ? (snapshot?.items ?? []) : []), ...result.items];
        if (
            (requestedCursor && snapshot?.revision !== result.revision) ||
            new Set(items.map((item) => item.id)).size !== items.length ||
            (result.nextCursor && result.nextCursor === requestedCursor)
        )
            throw new HttpError('节点分页已失效，请重新加载', 'protocol');
        return { ...result, items };
    });
    watch(
        reader.data,
        (value) => {
            accepted.value = value;
            if (!value) cursor = undefined;
        },
        { flush: 'sync' }
    );
    function reload() {
        cursor = undefined;
        return reader.refresh();
    }
    function more() {
        cursor = reader.data.value?.nextCursor ?? undefined;
        return reader.refresh();
    }
    return { data: reader.data, loading: reader.loading, error: reader.error, reload, more };
}
