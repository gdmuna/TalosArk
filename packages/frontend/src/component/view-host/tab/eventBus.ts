import mitt from 'mitt';
import { tryOnUnmounted } from '@vueuse/core';

export type AppEvents = {
    'workbench.tab:create': { tabId: string };

    'workbench.tab:delete': { tabId: string };
};

const emitter = mitt<AppEvents>();

export const eventBus = emitter;

export function useEventBus() {
    const cleanup: (() => void)[] = [];

    function on<Key extends keyof AppEvents>(
        type: Key,
        handler: (payload: AppEvents[Key]) => void
    ) {
        emitter.on(type, handler);
        cleanup.push(() => emitter.off(type, handler));
    }

    function off<Key extends keyof AppEvents>(
        type: Key,
        handler: (payload: AppEvents[Key]) => void
    ) {
        emitter.off(type, handler);
    }

    tryOnUnmounted(() => {
        for (const fn of cleanup) fn();
        cleanup.length = 0;
    });

    return {
        on,
        off,
        emit: emitter.emit,
        clear: () => emitter.all.clear(),
        all: emitter.all,
    };
}

export default eventBus;
