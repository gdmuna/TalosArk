import { computed, onScopeDispose, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { HistoryState, Router } from 'vue-router';

export const useNavigationStore = defineStore('browser-navigation', () => {
    const historyState = shallowRef<HistoryState>({});
    const canBack = computed(() => !!historyState.value.back);
    const canForward = computed(() => !!historyState.value.forward);
    let router: Router;
    let stop: (() => void) | undefined;
    function initialize(value: Router) {
        stop?.();
        router = value;
        const refresh = () => {
            historyState.value = { ...router.options.history.state };
        };
        refresh();
        const removeGuard = router.afterEach(refresh);
        window.addEventListener('popstate', refresh);
        stop = () => {
            removeGuard();
            window.removeEventListener('popstate', refresh);
        };
    }
    onScopeDispose(() => stop?.());
    const back = () => router.back();
    const forward = () => router.forward();
    return { historyState, canBack, canForward, initialize, back, forward };
});
