import { nextTick, onScopeDispose, ref, type Ref } from 'vue';

export function useColumnResize(options: {
    frame: Ref<HTMLElement | null>;
    canStart: () => boolean;
    getSize: (id: string) => number;
    resize: (id: string, size: number) => void;
}) {
    const resizing = ref<string | null>(null);
    let stopResize: (() => void) | undefined;
    function startResize(event: PointerEvent, id: string) {
        if (event.button !== 0 || !options.canStart()) return;
        stopResize?.();
        const handle = event.currentTarget as HTMLElement;
        const cell = handle.closest('th') as HTMLElement;
        const grabOffset = event.clientX - cell.getBoundingClientRect().right;
        let centered: HTMLElement | null = options.frame.value?.parentElement ?? null;
        while (centered && centered.computedStyleMap?.().get('margin-left')?.toString() !== 'auto')
            centered = centered.parentElement;
        let pointerX = event.clientX;
        let animationFrame = 0;
        let updating = false;
        let released = false;
        let active = true;
        resizing.value = id;
        handle.setPointerCapture(event.pointerId);
        async function update() {
            animationFrame = 0;
            updating = true;
            const target = pointerX - grabOffset;
            // Usually one pass; a second handles crossing the centered/overflow or minimum-width boundary.
            for (let pass = 0; pass < 3 && active; pass++) {
                const error = target - cell.getBoundingClientRect().right;
                if (Math.abs(error) < 0.5) break;
                const followsCenter =
                    centered &&
                    parseFloat(getComputedStyle(centered).marginLeft) > 0 &&
                    Math.abs(
                        centered.getBoundingClientRect().width -
                            (options.frame.value?.getBoundingClientRect().width ?? 0)
                    ) < 1;
                const previous = options.getSize(id);
                options.resize(id, previous + error / (followsCenter ? 0.5 : 1));
                await nextTick();
                if (!active) return;
                if (options.getSize(id) === previous) break;
            }
            updating = false;
            if (pointerX - grabOffset !== target) schedule();
            else if (released) stopResize?.();
        }
        function schedule() {
            if (active && !updating && !animationFrame)
                animationFrame = requestAnimationFrame(() => void update());
        }
        function move(event: PointerEvent) {
            if (event.pointerId !== handlePointer) return;
            pointerX = event.clientX;
            schedule();
        }
        const handlePointer = event.pointerId;
        function release(event: PointerEvent) {
            if (event.pointerId !== handlePointer) return;
            pointerX = event.clientX;
            released = true;
            schedule();
        }
        stopResize = () => {
            active = false;
            cancelAnimationFrame(animationFrame);
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', release);
            handle.removeEventListener('pointercancel', cancel);
            if (handle.hasPointerCapture(handlePointer))
                handle.releasePointerCapture(handlePointer);
            resizing.value = null;
            stopResize = undefined;
        };
        function cancel() {
            stopResize?.();
        }
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', release);
        handle.addEventListener('pointercancel', cancel);
    }
    onScopeDispose(() => stopResize?.());
    return { resizing, startResize };
}
