import { computed, ref, type Ref } from 'vue';
import { useElementSize, useResizeObserver, useScroll } from '@vueuse/core';

export function useTableLayout(
    frame: Ref<HTMLElement | null>,
    horizontalViewport: Ref<HTMLElement | null>,
    contentWidth: Ref<number>,
    options: { minHeight: number; maxHeight?: number | string }
) {
    const { x: scrollLeft } = useScroll(horizontalViewport);
    const { width: viewportWidth } = useElementSize(horizontalViewport);
    const heightParent = computed(() => {
        let parent = frame.value?.parentElement;
        while (parent && parent !== document.body) {
            const styles = parent.computedStyleMap?.();
            const height = styles?.get('height')?.toString() ?? parent.style.height;
            const maxHeight = styles?.get('max-height')?.toString() ?? parent.style.maxHeight;
            if (
                parent.dataset.slot === 'scroll-area-viewport' ||
                (parent.clientHeight &&
                    ((height && height !== 'auto') ||
                        (maxHeight && maxHeight !== 'none') ||
                        /auto|scroll|hidden/.test(getComputedStyle(parent).overflowY)))
            )
                return parent;
            parent = parent.parentElement;
        }
        return undefined;
    });
    const availableHeight = ref<number>();
    function measureHeight() {
        if (!frame.value || !heightParent.value) return;
        const parent = heightParent.value;
        const offset =
            frame.value.getBoundingClientRect().top -
            parent.getBoundingClientRect().top +
            parent.scrollTop;
        let bottomPadding = 0;
        for (let node = frame.value.parentElement; node; node = node.parentElement) {
            bottomPadding += parseFloat(getComputedStyle(node).paddingBottom) || 0;
            if (node === parent) break;
        }
        availableHeight.value = Math.max(
            options.minHeight,
            parent.clientHeight - offset - bottomPadding
        );
    }
    useResizeObserver([frame, heightParent], measureHeight);
    const frameStyle = computed(() => ({
        width: contentWidth.value + 2 + 'px',
        minHeight: options.minHeight + 'px',
        maxHeight:
            typeof options.maxHeight === 'string'
                ? options.maxHeight
                : (options.maxHeight ?? availableHeight.value)
                  ? `${options.maxHeight ?? availableHeight.value}px`
                  : undefined,
    }));
    // The vertical viewport spans all columns; keep its fixed edge inside the native horizontal viewport.
    const stickyRight = computed(() =>
        Math.max(0, contentWidth.value - viewportWidth.value - scrollLeft.value)
    );
    const verticalStyle = computed(() => ({
        width: contentWidth.value + 'px',
        '--data-table-sticky-right': stickyRight.value + 'px',
    }));
    return { frameStyle, stickyRight, verticalStyle };
}
