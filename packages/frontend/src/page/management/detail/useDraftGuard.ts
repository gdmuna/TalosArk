import { onScopeDispose, ref, type Ref } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';

export function useDraftGuard(dirty: Ref<boolean>, discard: () => void) {
    const open = ref(false);
    let resolve: ((leave: boolean) => void) | undefined;
    const guard = () => {
        if (!dirty.value) return true;
        if (resolve) return false;
        open.value = true;
        return new Promise<boolean>((done) => {
            resolve = done;
        });
    };
    function decide(leave: boolean) {
        if (leave) discard();
        open.value = false;
        resolve?.(leave);
        resolve = undefined;
    }
    onBeforeRouteLeave(guard);
    onBeforeRouteUpdate((to, from) => (to.fullPath === from.fullPath ? true : guard()));
    onScopeDispose(() => resolve?.(false));
    return { open, decide };
}
