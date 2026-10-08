import { unref, readonly, computed, onUnmounted, type InjectionKey, type MaybeRef } from 'vue';

import { provideLocal, injectLocal } from '@vueuse/core';

import { useRouter, useRoute, type RouteLocationRaw } from 'vue-router';

import { resolveDefaultTitle } from '@/shared/util';
import { useUiContextStore } from '@/component/view-context';
import type { ViewHistoryEntryOpts, ViewHistoryEntity } from '@/component/view-context';

export type {
    ViewHistoryEntry,
    ViewHistoryEntryOpts,
    ViewHistoryEntity,
} from '@/component/view-context';

export type ViewHistorySyncOpts = {
    force?: boolean;
};

export type ViewHistoryContext = Map<string, ViewHistoryEntity>;

export const ViewHistoryContextKey: InjectionKey<ViewHistoryContext> = Symbol('ViewHistoryContext');

export function useViewHistoryProvider() {
    const scope = useUiContextStore().createViewHistory();
    const store = scope.state;
    provideLocal(ViewHistoryContextKey, store);

    const clear = () => {
        store.clear();
    };

    onUnmounted(() => {
        clear();
        scope.dispose();
    });

    return { clear };
}

export function useViewHistory() {
    const store = injectLocal(ViewHistoryContextKey);
    if (!store) {
        throw new Error('useViewHistory 未在 ViewHistoryProvider 上下文中使用');
    }
    const router = useRouter();
    const route = useRoute();

    const push = (contextId: string, payload: ViewHistoryEntryOpts) => {
        let entity = store.get(contextId);

        if (!entity) {
            entity = { entry: [], cursor: -1, navigationPending: false };
            store.set(contextId, entity);
        }

        const previousEntry = entity.entry[entity.cursor];
        if (previousEntry?.fullPath === payload.fullPath) return false;
        entity.entry.splice(entity.cursor + 1);
        entity.entry.push({ ...payload, contextId });
        entity.cursor = entity.entry.length - 1;
        return true;
    };

    const pushNow = (contextId: string) => {
        const { path, fullPath, query, hash, params } = route;
        const title = resolveDefaultTitle(route);
        return push(contextId, {
            path,
            fullPath,
            query,
            hash,
            params,
            title,
        });
    };

    const trackRouter = (contextId: string) => {
        pushNow(contextId);
        const stop = router.afterEach((to, _from, failure) => {
            if (failure || store.get(contextId)?.navigationPending) return;
            const { path, fullPath, params, query, hash } = to;
            push(contextId, {
                path,
                fullPath,
                params,
                query,
                hash,
                title: resolveDefaultTitle(to),
            });
        });
        onUnmounted(stop);
        return stop;
    };

    // Replaying an entry must not be recorded as a new navigation or truncate its forward branch.
    const syncToIndex = async (contextId: string, index: number) => {
        const entity = store.get(contextId);
        const target = entity?.entry[index];
        if (!entity || !target || entity.navigationPending || !Number.isInteger(index)) return;
        entity.navigationPending = true;
        try {
            const failure = await router.push(target.fullPath);
            if (!failure) entity.cursor = index;
            return failure;
        } finally {
            entity.navigationPending = false;
        }
    };

    const syncPush = async (
        contextId: MaybeRef<string>,
        payload: RouteLocationRaw,
        opts?: ViewHistorySyncOpts
    ) => {
        const { force = false } = opts ?? {};
        const failure = await router.push(payload);
        if (failure && !force) return failure;
        const historyState = pushNow(unref(contextId));
        return {
            failure,
            historyState,
        };
    };

    const back = (contextId: string) => {
        const entity = store.get(contextId);
        if (!entity || entity.cursor <= 0 || entity.navigationPending) return undefined;
        entity.cursor--;
        return entity.entry[entity.cursor];
    };

    const syncBack = (contextId: string) => {
        const entity = store.get(contextId);
        if (entity) return syncToIndex(contextId, entity.cursor - 1);
    };

    const canBack = (contextId: MaybeRef<string>) => {
        return computed(() => {
            const entity = store.get(unref(contextId));
            if (!entity) return false;
            return !entity.navigationPending && entity.cursor > 0;
        });
    };

    const forward = (contextId: string) => {
        const entity = store.get(contextId);
        if (!entity || entity.cursor >= entity.entry.length - 1 || entity.navigationPending)
            return undefined;
        entity.cursor++;
        return entity.entry[entity.cursor];
    };

    const syncForward = (contextId: string) => {
        const entity = store.get(contextId);
        if (entity) return syncToIndex(contextId, entity.cursor + 1);
    };

    const canForward = (contextId: MaybeRef<string>) => {
        return computed(() => {
            const entity = store.get(unref(contextId));
            if (!entity) return false;
            return !entity.navigationPending && entity.cursor < entity.entry.length - 1;
        });
    };

    const go = (contextId: string, delta: number) => {
        const entity = store.get(contextId);
        delta = Math.floor(delta);
        if (
            !entity ||
            !Number.isFinite(delta) ||
            delta > entity.entry.length - 1 ||
            delta < 0 ||
            entity.navigationPending
        )
            return undefined;
        entity.cursor = delta;
        return entity.entry[entity.cursor];
    };

    const syncGo = (contextId: string, delta: number) => {
        return syncToIndex(contextId, delta);
    };

    const canGo = (contextId: MaybeRef<string>, delta: MaybeRef<number>) => {
        return computed(() => {
            const entity = store.get(unref(contextId));
            const index = unref(delta);
            return (
                !!entity &&
                !entity.navigationPending &&
                Number.isInteger(index) &&
                index >= 0 &&
                index < entity.entry.length
            );
        });
    };

    const replace = (contextId: string, delta: number, payload: ViewHistoryEntryOpts) => {
        const entity = store.get(contextId);
        if (!entity) return undefined;
        return (entity.entry[delta] = {
            contextId,
            ...payload,
        });
    };

    const replaceNow = (contextId: string, delta?: number) => {
        const { path, fullPath, query, hash, params } = route;
        const title = resolveDefaultTitle(route);
        const entity = store.get(contextId);
        if (!entity) return undefined;
        delta = delta ?? entity.cursor;
        return replace(contextId, delta, {
            path,
            fullPath,
            query,
            hash,
            params,
            title,
        });
    };

    const syncReplace = async (
        contextId: string,
        payload: RouteLocationRaw,
        delta?: number,
        opts?: ViewHistorySyncOpts
    ) => {
        const { force = false } = opts ?? {};
        const failure = await router.replace(payload);
        if (failure && !force) return failure;
        const historyState = replaceNow(contextId, delta);
        return {
            failure,
            historyState,
        };
    };

    const getActiveEntry = (contextId: MaybeRef<string>) => {
        return computed(() => {
            const entity = store.get(unref(contextId));
            if (!entity) return undefined;
            return entity.entry[entity.cursor];
        });
    };

    const getEntity = (contextId: MaybeRef<string>) => {
        return computed(() => {
            const entity = store.get(unref(contextId));
            if (!entity) return undefined;
            return entity;
        });
    };

    const setTitle = (contextId: string, title: string, delta?: number) => {
        const entity = store.get(contextId);
        if (!entity) return false;
        const idx = Math.floor(delta ?? entity.cursor);
        entity.entry[idx].title = title;
        return true;
    };

    return {
        push,
        pushNow,
        trackRouter,
        syncPush,
        back,
        syncBack,
        canBack,
        forward,
        syncForward,
        canForward,
        go,
        syncGo,
        canGo,
        replace,
        replaceNow,
        syncReplace,
        getActiveEntry,
        getEntity,
        setTitle,
        store: readonly(store),
    };
}
