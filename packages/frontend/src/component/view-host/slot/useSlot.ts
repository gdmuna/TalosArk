import {
    provide,
    inject,
    computed,
    markRaw,
    onUnmounted,
    reactive,
    type Reactive,
    type InjectionKey,
    type Component,
} from 'vue';

import { v7 as uuidv7 } from 'uuid';

import { useTab } from '../tab/useTab';
import { useUiContextStore } from '@/component/view-context';
import type { SlotContextEntity } from '../type';

export type { SlotContextEntity } from '../type';

export type SlotContext = Reactive<Map<string, SlotContextEntity[]>>;

export const SlotContextKey: InjectionKey<SlotContext> = Symbol('SlotContext');
export const SlotNamespaceKey: InjectionKey<string> = Symbol('SlotNamespace');

export function useSlotProvider() {
    const scope = useUiContextStore().register(reactive(new Map<string, SlotContextEntity[]>()));
    const store = scope.state;
    provide(SlotContextKey, store);

    onUnmounted(() => {
        store.clear();
        scope.dispose();
    });

    const clear = () => {
        store.clear();
    };

    return { clear };
}

function resolveKey(slotName: string, explicitNs?: string): string {
    const injectedNs = inject(SlotNamespaceKey, '');
    const ns = explicitNs ?? injectedNs;
    return ns ? `${ns}:${slotName}` : slotName;
}

export function useSlotTarget(
    slotName: string,
    namespace?: string,
    customCompareFn?: (a: SlotContextEntity, b: SlotContextEntity) => number
) {
    const store = inject(SlotContextKey);
    if (!store) {
        throw new Error(`'useSlotTarget' 必须在提供 'SlotContextKey' 的组件树中使用`);
    }

    const key = resolveKey(slotName, namespace);

    if (!store.has(key)) store.set(key, []);

    const rawSlotEntity = computed(() => {
        return store.get(key) ?? [];
    });

    const slotEntity = computed(() => {
        return [...rawSlotEntity.value].sort(customCompareFn ?? sortCompareFn);
    });

    return { rawSlotEntity, slotEntity };
}

export type UseSlotOptions = {
    id?: string;
    order?: number | string;
    enable?: boolean;
    stable?: boolean;
    keepAlive?: boolean;
    namespace?: string;
};

export type UseSlotSortCompareFn = (a: SlotContextEntity, b: SlotContextEntity) => number;

/**
 * 比较器生成：存入 store 时以优先级高低为默认排序方式
 * 兼容 number 与 string 混合比较
 */
function sortCompareFn(a: SlotContextEntity, b: SlotContextEntity) {
    const ao = a.order;
    const bo = b.order;

    if (typeof ao === 'number' && typeof bo === 'number') {
        return bo - ao;
    }
    if (typeof ao === 'string' && typeof bo === 'string') {
        return ao.localeCompare(bo);
    }
    // number 优先于 string
    return typeof ao === 'number' ? 1 : -1;
}

export function useSlot(slotName: string, component: Component, opts: UseSlotOptions = {}) {
    const store = inject(SlotContextKey);
    if (!store) {
        throw new Error(`'useSlot' 必须在提供 'SlotContextKey' 的组件树中使用`);
    }

    const { activeTabId } = useTab();

    const {
        id = uuidv7(),
        order = 0,
        enable = true,
        stable = false,
        keepAlive = true,
        namespace,
    } = opts;
    const key = resolveKey(slotName, namespace);

    const slotEntity = store.get(key) ?? [];

    slotEntity.push({
        id,
        tabId: activeTabId.value,
        component: markRaw(component),
        order,
        enable,
        stable,
        keepAlive,
    });
    slotEntity.sort(sortCompareFn);
    store.set(key, slotEntity);

    const dispose = () => {
        const entries = store.get(key) ?? [];

        const idx = entries.findIndex((e) => e.id === id);
        if (idx === -1) {
            console.warn(`useSlot: 无法找到要卸载的 slot 实体，key=${key}，id=${id}`);
            return;
        }

        entries.splice(idx, 1);
        if (entries.length === 0) store.delete(key);
        else store.set(key, entries);
    };

    onUnmounted(() => {
        dispose();
    });

    return { dispose };
}

export function isAvailableSlot(slotName: string, namespace?: string) {
    const store = inject(SlotContextKey);
    if (!store) {
        throw new Error(`'isAvailableSlot' 必须在提供 'SlotContextKey' 的组件树中使用`);
    }
    const key = resolveKey(slotName, namespace);
    return computed(() => store.has(key));
}
