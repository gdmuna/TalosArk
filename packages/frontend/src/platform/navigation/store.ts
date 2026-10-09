import { computed, onScopeDispose, reactive, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { HistoryState, Router } from 'vue-router';

export type NavigationOrigin = { to: string; label: string; position: number };
function readOrigin(value: HistoryState[string] | undefined): NavigationOrigin | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return typeof value.to === 'string' &&
        typeof value.label === 'string' &&
        typeof value.position === 'number'
        ? { to: value.to, label: value.label, position: value.position }
        : null;
}

export const useNavigationStore = defineStore('browser-navigation', () => {
    const historyState = shallowRef<HistoryState>({});
    const locations = reactive(new Map<string, string>());
    const labels = new Map<string, string>();
    const origin = computed(() => readOrigin(historyState.value.navigationOrigin));
    const canBack = computed(() => !!historyState.value.back);
    const canForward = computed(() => !!historyState.value.forward);
    let router: Router;
    let stop: (() => void) | undefined;
    function initialize(value: Router) {
        stop?.();
        router = value;
        const refresh = () => {
            historyState.value = { ...router.options.history.state };
            const route = router.currentRoute.value;
            locations.set(route.path, route.fullPath);
        };
        refresh();
        const removeGuard = router.afterEach((to, from, failure) => {
            if (failure) return;
            const state = router.options.history.state;
            if (!Object.hasOwn(state, 'navigationOrigin')) {
                const previous = historyState.value;
                const source =
                    to.path === from.path
                        ? readOrigin(previous.navigationOrigin)
                        : from.matched.length && typeof previous.position === 'number'
                          ? {
                                to: from.fullPath,
                                label: labels.get(from.path) ?? from.meta.pageLabel ?? '返回上一页',
                                position: previous.position,
                            }
                          : null;
                router.options.history.replace(to.fullPath, { navigationOrigin: source });
            }
            refresh();
        });
        window.addEventListener('popstate', refresh);
        stop = () => {
            removeGuard();
            window.removeEventListener('popstate', refresh);
        };
    }
    onScopeDispose(() => stop?.());
    const back = () => router.back();
    const forward = () => router.forward();
    const lastLocation = (path: string) => locations.get(path) ?? path;
    const setPageLabel = (path: string, label: string) => labels.set(path, label);
    function returnTo(source: NavigationOrigin | null, fallback: string) {
        const position = router.options.history.state.position;
        if (source && typeof position === 'number' && position > source.position) {
            router.go(source.position - position);
        } else {
            void router.push(source?.to ?? fallback);
        }
    }
    return {
        historyState,
        canBack,
        canForward,
        initialize,
        back,
        forward,
        lastLocation,
        origin,
        setPageLabel,
        returnTo,
    };
});
