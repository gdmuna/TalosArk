import { MaybeArray, asArray } from '@/shared/util';

import { computed, onUnmounted, reactive, type Reactive, type InjectionKey, UnwrapRef } from 'vue';
import { useUiContextStore } from '@/component/view-context';

import { provideLocal, injectLocal } from '@vueuse/core';

export type RouteTabContextEntity<T = unknown> = {
    id: string;
    value: T;
};

export type RouteTabContext<T = unknown> = {
    store: Reactive<Map<string, RouteTabContextEntity<T>>>;
    tabOrder: Reactive<string[]>;
};

export const __NULL_TAB_ID__ = '__NULL__';

export function createRouteTabContext<T = unknown>() {
    const RouteTabContextKey: InjectionKey<RouteTabContext<T>> = Symbol('RouteTabContext');

    const provideRouteTabContext = () => {
        const scope = useUiContextStore().register({
            store: reactive(new Map<string, RouteTabContextEntity<T>>()),
            tabOrder: reactive<string[]>([]),
        });
        const { store, tabOrder } = scope.state;

        const ctx = {
            store,
            tabOrder,
        };
        provideLocal(RouteTabContextKey, ctx);

        onUnmounted(() => {
            store.clear();
            scope.dispose();
        });

        const clear = () => {
            store.clear();
        };

        return { clear, RouteTabContextKey, ctx };
    };

    const useRouteTab = () => {
        const ctx = injectLocal(RouteTabContextKey);
        if (!ctx) {
            throw new Error('useRouteTab 未在 RouteTabProvider 上下文中使用');
        }

        const { store, tabOrder } = ctx;

        const setEntity = (dto: MaybeArray<RouteTabContextEntity<T>>) => {
            tabOrder.splice(0);
            store.clear();
            asArray(dto).forEach((item) => {
                tabOrder.push(item.id);
                store.set(item.id, item as UnwrapRef<RouteTabContextEntity<T>>);
            });
        };

        const tabEntity = computed(() => {
            return tabOrder.flatMap((tid) => store.get(tid) ?? []);
        });

        const getEntity = (tid: string) => {
            return store.get(tid);
        };

        return {
            setEntity,
            getEntity,
            tabEntity,
        };
    };

    return {
        provideRouteTabContext,
        useRouteTab,
    };
}
