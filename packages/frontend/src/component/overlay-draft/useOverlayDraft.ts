import {
    computed,
    onScopeDispose,
    ref,
    toValue,
    watch,
    type MaybeRefOrGetter,
    type Ref,
} from 'vue';
import { useEventListener } from '@vueuse/core';
import { useRouter } from 'vue-router';

/** Protect unsent form input, not commands already recorded by their business owner. */
export function useOverlayDraft(
    open: Ref<boolean>,
    snapshot: () => string,
    options: { busy?: MaybeRefOrGetter<boolean>; saved?: MaybeRefOrGetter<boolean> } = {}
) {
    const initial = ref('');
    const confirmOpen = ref(false);
    const dirty = computed(
        () => open.value && !toValue(options.saved) && snapshot() !== initial.value
    );
    const markClean = () => (initial.value = snapshot());
    const router = useRouter();
    let routeDecision: ((leave: boolean) => void) | undefined;
    let leaving = false;
    const removeGuard = router.beforeEach(() => {
        if (!open.value) return;
        if (toValue(options.busy)) return false;
        if (!dirty.value) return;
        if (routeDecision) return false;
        confirmOpen.value = true;
        return new Promise<boolean>((resolve) => {
            routeDecision = resolve;
        });
    });
    const removeAfter = router.afterEach((_to, _from, failure) => {
        // A second draft guard can still cancel navigation; discard only after it commits.
        if (leaving && !failure) open.value = false;
        leaving = false;
    });
    watch(confirmOpen, (value) => {
        if (!value && routeDecision) {
            routeDecision(false);
            routeDecision = undefined;
        }
    });
    watch(
        open,
        (value) => {
            confirmOpen.value = false;
            if (value) markClean();
        },
        { flush: 'post', immediate: true }
    );
    const guardedOpen = computed({
        get: () => open.value,
        set: (value) => {
            if (toValue(options.busy)) return;
            if (!value && dirty.value) confirmOpen.value = true;
            else open.value = value;
        },
    });
    function discard() {
        if (routeDecision) {
            leaving = true;
            routeDecision(true);
            routeDecision = undefined;
            confirmOpen.value = false;
            return;
        }
        confirmOpen.value = false;
        open.value = false;
    }
    onScopeDispose(() => {
        routeDecision?.(false);
        removeGuard();
        removeAfter();
    });
    useEventListener(window, 'beforeunload', (event) => {
        if (!dirty.value) return;
        event.preventDefault();
        event.returnValue = '';
    });
    return { guardedOpen, confirmOpen, discard, markClean };
}
