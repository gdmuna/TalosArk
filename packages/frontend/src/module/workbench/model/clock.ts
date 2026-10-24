import { watch } from 'vue';
import { useDocumentVisibility, useEventListener, useTimestamp } from '@vueuse/core';

export function useWorkbenchClock() {
    const { timestamp, pause, resume } = useTimestamp({
        controls: true,
        interval: 1000,
        immediate: false,
    });
    const visibility = useDocumentVisibility();
    function calibrate() {
        if (visibility.value === 'visible') timestamp.value = Date.now();
    }
    watch(
        visibility,
        (value) => {
            if (value === 'hidden') pause();
            else {
                calibrate();
                resume();
            }
        },
        { immediate: true }
    );
    useEventListener('focus', calibrate);
    return timestamp;
}
