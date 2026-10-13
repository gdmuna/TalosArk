import { computed, ref, type Ref } from 'vue';
import { useElementSize, useResizeObserver, useScroll } from '@vueuse/core';
import { findHeightConstraint } from './geometry';

export function useTableLayout(
    frame: Ref<HTMLElement | null>,
    horizontalViewport: Ref<HTMLElement | null>,
    contentWidth: Ref<number>,
    options: { minRows: number; minHeight?: number; maxHeight?: number | string },
    parts: {
        header: Ref<HTMLElement | null>;
        footer: Ref<HTMLElement | null>;
        records: Ref<HTMLElement | undefined>;
        viewport: Ref<HTMLElement | undefined>;
    }
) {
    const { x: scrollLeft } = useScroll(horizontalViewport);
    const { width: viewportWidth } = useElementSize(horizontalViewport);
    const { height: recordViewportHeight } = useElementSize(parts.viewport);
    const heightParent = computed(() =>
        frame.value ? findHeightConstraint(frame.value) : undefined
    );
    const chromeHeight = ref(0);
    const rowHeight = ref(57); // Default single-line row with 32px actions, 24px padding and a border.
    const minimumRecordHeight = computed(
        () =>
            Math.max(
                Math.ceil(options.minRows),
                Math.ceil(((options.minHeight ?? 0) - chromeHeight.value) / rowHeight.value)
            ) * rowHeight.value
    );
    const minimumHeight = computed(() => chromeHeight.value + minimumRecordHeight.value);
    const emptyHeight = computed(() => recordViewportHeight.value || minimumRecordHeight.value);
    const availableHeight = ref<number>();
    function measureHeight() {
        if (!frame.value) return;
        const firstRow = parts.records.value?.querySelector<HTMLElement>('[data-record-row]');
        if (firstRow?.offsetHeight) rowHeight.value = firstRow.getBoundingClientRect().height;
        // Reserve complete rows separately from the header, footer and native horizontal scrollbar.
        const horizontalScrollbar = horizontalViewport.value
            ? horizontalViewport.value.offsetHeight - horizontalViewport.value.clientHeight
            : 0;
        chromeHeight.value =
            (parts.header.value?.offsetHeight ?? 0) +
            (parts.footer.value?.offsetHeight ?? 0) +
            horizontalScrollbar +
            1; // Two frame borders minus the shared footer/last-row border.
        if (!heightParent.value) {
            availableHeight.value = undefined;
            return;
        }
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
        availableHeight.value = parent.clientHeight - offset - bottomPadding;
    }
    useResizeObserver(
        [frame, heightParent, horizontalViewport, parts.header, parts.footer, parts.records],
        measureHeight
    );
    const frameStyle = computed(() => ({
        width: contentWidth.value + 2 + 'px',
        minHeight: minimumHeight.value + 'px',
        maxHeight:
            typeof options.maxHeight === 'string'
                ? options.maxHeight
                : (options.maxHeight ?? availableHeight.value)
                  ? `${Math.max(minimumHeight.value, options.maxHeight ?? availableHeight.value ?? 0)}px`
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
    return { frameStyle, stickyRight, verticalStyle, emptyHeight };
}
