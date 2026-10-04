import { reactive, ref, shallowReactive } from 'vue';
import { defineStore } from 'pinia';
import type {
    RouteTabContextEntity,
    TabContextEntity,
    TabComponentContextEntity,
    TabComponentContextState,
    TabCustomContextStore,
    ViewHistoryEntity,
    SlotContextEntity,
} from '@/shared/models/ui-context';

export const useUiContextStore = defineStore('ui-contexts', () => {
    // Each provider owns a scope; nested shells never share an accidental singleton.
    const scopes = shallowReactive(new Map<string, object>());
    function register<T extends object>(state: T) {
        const id = crypto.randomUUID();
        scopes.set(id, state);
        return { state, dispose: () => scopes.delete(id) };
    }
    function createRouteTabs<T>() {
        return register({
            store: reactive(new Map<string, RouteTabContextEntity<T>>()),
            tabOrder: reactive<string[]>([]),
        });
    }
    function createWorkspaceTabs() {
        return register({
            store: reactive(new Map<string, TabContextEntity>()),
            tabOrder: reactive<string[]>([]),
            activeTabId: ref('__NULL__'),
        });
    }
    function createTabComponents() {
        return register({
            store: reactive(new Map<string, Map<string, TabComponentContextEntity>>()),
            state: ref<TabComponentContextState>('idle'),
            createTabRule: reactive(new Set<RegExp>()),
        });
    }
    const createTabContext = () => register(reactive<TabCustomContextStore>(new Map()));
    const createViewHistory = () => register(reactive(new Map<string, ViewHistoryEntity>()));
    const createSlots = () => register(reactive(new Map<string, SlotContextEntity[]>()));
    return {
        scopes,
        createRouteTabs,
        createWorkspaceTabs,
        createTabComponents,
        createTabContext,
        createViewHistory,
        createSlots,
    };
});
