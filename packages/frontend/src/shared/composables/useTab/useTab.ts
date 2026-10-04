import {
    readonly,
    computed,
    onUnmounted,
    type InjectionKey,
    type Ref,
    type ComputedRef,
    type Reactive,
} from 'vue';

import { v7 as uuidv7 } from 'uuid';

import { provideLocal, injectLocal } from '@vueuse/core';

import { eventBus } from './eventBus';
import { useUiContextStore } from '@/shared/stores/ui-context.store';
import type { TabContextEntity, TabContextCreateOpts } from '@/shared/models/ui-context';

export type { TabContextEntity, TabContextCreateOpts } from '@/shared/models/ui-context';

export type TabContext = {
    store: Reactive<Map<string, TabContextEntity>>;
    tabOrder: Reactive<string[]>;
    activeTabId: Ref<string>;
    activeTabIdIsNull: ComputedRef<boolean>;
    setActiveTabId: (tabId?: string | null) => void;
};

export const TabContextKey: InjectionKey<TabContext> = Symbol('TabContext');

export function useTabProvider() {
    const scope = useUiContextStore().createWorkspaceTabs();
    const { store, tabOrder, activeTabId: _activeTabId } = scope.state;
    const activeTabId = readonly(_activeTabId);
    const setActiveTabId = (tabId?: string | null) => {
        if (tabId === undefined || tabId === null) _activeTabId.value = '__NULL__';
        else _activeTabId.value = tabId;
    };
    const activeTabIdIsNull = computed(() => _activeTabId.value === '__NULL__');

    provideLocal(TabContextKey, {
        store,
        tabOrder,
        activeTabId,
        activeTabIdIsNull,
        setActiveTabId,
    });

    onUnmounted(() => {
        store.clear();
        scope.dispose();
    });

    const clear = () => {
        store.clear();
    };

    return {
        clear,
        activeTabId,
        activeTabIdIsNull,
        setActiveTabId,
    };
}

export function useTab() {
    const context = injectLocal(TabContextKey);
    if (!context) {
        throw new Error('useTab 未在 TabProvider 上下文中使用');
    }

    const { store, tabOrder, activeTabId, activeTabIdIsNull, setActiveTabId } = context;

    const createTab = (opts?: TabContextCreateOpts) => {
        if (!store) throw new Error('该函数未在 TabProvider 上下文中使用');
        const {
            id = uuidv7(),
            // title = '',
            createAt = new Date(),
        } = opts ?? {};

        const tabEntity = { id, createAt };
        store.set(id, tabEntity);

        const afterIdx = Math.floor(opts?.afterIdx ?? -1);
        if (afterIdx > -1) {
            tabOrder.splice(afterIdx + 1, 0, id);
        } else {
            tabOrder.push(id);
        }

        eventBus.emit('workbench.tab:create', { tabId: id });
        return { ...tabEntity };
    };

    const tabEntity = computed(() => {
        if (!store) return [];
        return tabOrder.flatMap((id) => store.get(id) ?? []);
    });

    const getTabEntity = (tabId: string) => {
        if (!store) throw new Error('该函数未在 TabProvider 上下文中使用');

        const entity = store.get(tabId);
        if (!entity) {
            throw new Error(`tabId ${tabId} 不存在`);
        }
        return entity;
    };

    const activeTabEntity = computed(() => {
        if (activeTabIdIsNull.value || !store) return null;
        return store.get(activeTabId.value) ?? null;
    });

    const deleteTab = (tabId: string | string[]) => {
        if (!store) throw new Error('该函数未在 TabProvider 上下文中使用');
        const tabIds = Array.isArray(tabId) ? tabId : [tabId];

        const beforeActiveTabId = activeTabId.value;
        let deleteActiveTab = false;
        let minIdx = tabOrder.length - 1;
        for (const id of tabIds) {
            if (!store.has(id)) {
                console.warn(`tabId ${id} 不存在`);
                continue;
            }
            store.delete(id);

            const idx = tabOrder.findIndex((ID) => ID === id);
            tabOrder.splice(idx, 1);
            minIdx = Math.max(-1, Math.min(minIdx, idx));
            if (beforeActiveTabId === id) deleteActiveTab = true;
            eventBus.emit('workbench.tab:delete', { tabId: id });
        }
        if (!deleteActiveTab) return { next: activeTabId.value };
        if (tabOrder.length === 0) return { next: '__NULL__' };
        if (minIdx > 0) return { next: tabOrder[minIdx - 1] };
        return { next: tabOrder[0] };
    };

    const moveTab = (from: number, to: number) => {
        from = Math.floor(from);
        to = Math.floor(to);
        const [move] = tabOrder.splice(from, 1);
        tabOrder.splice(to, 0, move);
    };

    // const setTitle = (tabId: string, title: string) => {
    //     const entity = store.get(tabId)
    //     if (!entity) {
    //         return false;
    //     }
    //     entity.title = title;
    //     return true;
    // }

    return {
        createTab,
        tabEntity,
        getTabEntity,
        activeTabId,
        activeTabIdIsNull,
        activeTabEntity,
        setActiveTabId,
        deleteTab,
        moveTab,
        // setTitle,
        store: readonly(store),
    };
}
