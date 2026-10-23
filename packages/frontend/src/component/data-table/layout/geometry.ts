function layoutValue(element: HTMLElement, property: string) {
    return (
        element.computedStyleMap?.().get(property)?.toString() ??
        element.style.getPropertyValue(property)
    );
}

export function findHeightConstraint(frame: HTMLElement) {
    let parent = frame.parentElement;
    while (parent && parent !== document.body) {
        const height = layoutValue(parent, 'height');
        const maxHeight = layoutValue(parent, 'max-height');
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
}

export function findCenteredContainer(frame: HTMLElement) {
    let parent = frame.parentElement;
    while (parent && layoutValue(parent, 'margin-left') !== 'auto') parent = parent.parentElement;
    return parent;
}

export function isTableCentered(container: HTMLElement | null, frame: HTMLElement | null) {
    if (!container || !frame) return false;
    const width = layoutValue(container, 'width');
    const frameWidth = frame.getBoundingClientRect().width;
    // Only intrinsic-width containers move with the table; full-width or clamped frames do not.
    return (
        (width === 'auto' || width === 'fit-content' || width === 'max-content') &&
        parseFloat(getComputedStyle(container).marginLeft) > 0 &&
        Math.abs(container.getBoundingClientRect().width - frameWidth) < 1 &&
        Math.abs(parseFloat(frame.style.width) - frameWidth) < 1
    );
}

export function measureGridInsets(element: HTMLElement) {
    const cell = getComputedStyle(element);
    const border = getComputedStyle(element, '::before');
    // The grid is positioned from the padding box; map its inner edges to the border box.
    return {
        top:
            parseFloat(cell.borderTopWidth) +
            parseFloat(border.top) +
            parseFloat(border.borderTopWidth),
        right:
            parseFloat(cell.borderRightWidth) +
            parseFloat(border.right) +
            parseFloat(border.borderRightWidth),
        bottom:
            parseFloat(cell.borderBottomWidth) +
            parseFloat(border.bottom) +
            parseFloat(border.borderBottomWidth),
        left:
            parseFloat(cell.borderLeftWidth) +
            parseFloat(border.left) +
            parseFloat(border.borderLeftWidth),
    };
}
