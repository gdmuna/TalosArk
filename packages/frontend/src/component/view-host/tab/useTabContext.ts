// TODO: 考虑废弃

import { readonly, onUnmounted, type InjectionKey } from 'vue';
import { useUiContextStore } from '@/component/view-context';
import type {
    TabCustomContextNamespace,
    TabCustomContextStore,
    TabCustomContextNamespaceKey,
} from '@/component/view-context';

import { provideLocal, injectLocal } from '@vueuse/core';

import { useTab } from './useTab';

export type {
    TabCustomContextNamespace,
    TabCustomContextStore,
    TabCustomContextNamespaceKey,
} from '@/component/view-context';

export const TabCustomContextKey: InjectionKey<TabCustomContextStore> = Symbol('TabCustomContext');

export function useTabCustomContextProvider() {
    const scope = useUiContextStore().createTabContext();
    const store = scope.state;
    provideLocal(TabCustomContextKey, store);

    const clear = () => {
        store.clear();
    };

    onUnmounted(() => {
        clear();
        scope.dispose();
    });

    return { clear };
}

export function useTabCustomContext() {
    const store = injectLocal(TabCustomContextKey);
    if (!store) {
        throw new Error('useTabCustomContext 必须在 TabCustomContextProvider 上下文中使用');
    }
    const { activeTabId } = useTab();

    const get = <Ns extends TabCustomContextNamespaceKey>(
        ns: Ns,
        tabId?: string
    ): TabCustomContextNamespace[Ns] | undefined => {
        tabId = tabId || activeTabId.value;
        const ctx = store.get(tabId);
        if (!ctx) return undefined;
        return ctx[ns];
    };

    const set = <Ns extends TabCustomContextNamespaceKey>(
        ns: Ns,
        payload: TabCustomContextNamespace[Ns],
        tabId?: string
    ) => {
        tabId = tabId || activeTabId.value;
        let ctx = store.get(tabId);
        if (!ctx) {
            ctx = {};
            store.set(tabId, ctx);
        }
        ctx[ns] = payload;
        return set;
    };

    const drop = <Ns extends TabCustomContextNamespaceKey>(ns: Ns, tabId?: string) => {
        tabId = tabId || activeTabId.value;
        const ctx = store.get(tabId);
        if (!ctx) return false;
        delete ctx[ns];
        return true;
    };

    return {
        get,
        set,
        drop,
        store: readonly(store),
    };
}
