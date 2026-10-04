import { nextTick, onScopeDispose, ref, watch } from 'vue';
import { gsap } from 'gsap';

type Rect = { x: number; y: number; width: number; height: number };
type Anchor = { id: string; rect: Rect };
type Motion = { offset: number; elements: HTMLElement[]; apply: (offset: number) => void };
type ReorderOptions = {
    root: () => HTMLElement | null | undefined;
    container: () => HTMLElement | null | undefined;
    destinationHost?: () => HTMLElement | null | undefined;
    destinationClip?: () => Rect | undefined;
    elements?: (root: HTMLElement) => Map<string, HTMLElement[]>;
    keepSourceVisible?: boolean;
};
const sameOrder = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id, i) => id === b[i]);

export function useDragReorder(
    axis: 'x' | 'y',
    ids: () => string[],
    reorder: (ids: string[]) => void,
    options: ReorderOptions
) {
    const dragging = ref<string | null>(null);
    const phase = ref<'idle' | 'dragging' | 'settling'>('idle');
    const motions = new Map<string, Motion>();
    const styles = new Map<HTMLElement, { transform: string; opacity: string }>();
    let anchors: Anchor[] = [];
    let bounds: Rect | null = null;
    let scale = 1;
    let draft: string[] = [];
    let preview: HTMLElement | null = null;
    let surface: HTMLElement | null = null;
    let destination: HTMLElement | null = null;
    let marker: HTMLElement | null = null;
    let validDrop = false;
    let previewFrame = 0;
    let layoutFrame = 0;
    let observer: ResizeObserver | null = null;
    let timeline: gsap.core.Timeline | null = null;
    let revision = 0;
    let pointerOffset = { x: 0, y: 0 };
    let previewSize = { width: 0, height: 0 };
    const duration = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.16);

    function remember(element: HTMLElement) {
        if (!styles.has(element))
            styles.set(element, {
                transform: element.style.transform,
                opacity: element.style.opacity,
            });
    }
    function restore(element: HTMLElement) {
        gsap.set(element, { clearProps: 'transform,opacity' });
        const original = styles.get(element);
        if (original) Object.assign(element.style, original);
    }
    function cleanup() {
        revision++;
        cancelAnimationFrame(previewFrame);
        cancelAnimationFrame(layoutFrame);
        previewFrame = layoutFrame = 0;
        document.removeEventListener('dragenter', over, true);
        document.removeEventListener('dragover', over, true);
        document.removeEventListener('drop', drop, true);
        document.removeEventListener('scroll', scheduleLayout, true);
        window.removeEventListener('resize', scheduleLayout);
        observer?.disconnect();
        observer = null;
        timeline?.kill();
        timeline = null;
        if (surface) gsap.killTweensOf(surface);
        if (preview) gsap.killTweensOf(preview);
        if (marker) gsap.killTweensOf(marker);
        if (destination) gsap.killTweensOf(destination);
        motions.forEach((motion) => gsap.killTweensOf(motion));
        styles.forEach((_, element) => restore(element));
        styles.clear();
        motions.clear();
        preview?.remove();
        destination?.remove();
        preview = surface = null;
        destination = marker = null;
        validDrop = false;
        anchors = [];
        bounds = null;
        draft = [];
        dragging.value = null;
        phase.value = 'idle';
    }
    onScopeDispose(cleanup);

    function measure() {
        const root = options.root();
        if (!root) return;
        bounds = root.getBoundingClientRect();
        const dimension = axis === 'x' ? 'width' : 'height';
        scale = bounds[dimension] / parseFloat(getComputedStyle(root)[dimension]) || 1;
        const elements = [...root.querySelectorAll<HTMLElement>('[data-reorder-id]')];
        // Logical anchors exclude animated offsets, so items cannot move their own hit targets.
        anchors = elements.map((element) => {
            const id = element.dataset.reorderId as string;
            const rect = element.getBoundingClientRect();
            const offset = motions.get(id)?.offset ?? 0;
            return {
                id,
                rect: {
                    x: rect.x - (axis === 'x' ? offset * scale : 0),
                    y: rect.y - (axis === 'y' ? offset * scale : 0),
                    width: rect.width,
                    height: rect.height,
                },
            };
        });
        const groups =
            options.elements?.(root) ??
            new Map(elements.map((element) => [element.dataset.reorderId as string, [element]]));
        groups.forEach((elements, id) => {
            const motion = motions.get(id) ?? { offset: 0, elements: [], apply: () => {} };
            motion.elements.filter((element) => !elements.includes(element)).forEach(restore);
            elements.forEach(remember);
            motion.elements = elements;
            motion.apply = gsap.quickSetter(elements, axis, 'px') as (offset: number) => void;
            motion.apply(motion.offset);
            motions.set(id, motion);
            if (id === dragging.value && !options.keepSourceVisible)
                gsap.set(elements, { opacity: 0 });
        });
    }
    function scheduleLayout() {
        if (phase.value !== 'dragging' || layoutFrame) return;
        layoutFrame = requestAnimationFrame(() => {
            layoutFrame = 0;
            measure();
            moveItems(draft, true);
        });
    }
    function moveItems(order: string[], force = false) {
        if (!force && sameOrder(order, draft)) return;
        draft = [...order];
        const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
        const visible = order.filter((id) => byId.has(id));
        const first = anchors[0];
        if (!first) return;
        let position = first.rect[axis];
        visible.forEach((id, index) => {
            const anchor = byId.get(id) as Anchor;
            const motion = motions.get(id) as Motion;
            if (id === dragging.value && validDrop)
                placeDestination({ ...anchor.rect, [axis]: position });
            const offset =
                id === dragging.value && !options.keepSourceVisible
                    ? 0
                    : (position - anchor.rect[axis]) / scale;
            gsap.to(motion, {
                offset,
                duration: duration(),
                ease: 'power2.out',
                overwrite: true,
                onUpdate: () => motion.apply(motion.offset),
            });
            const size = axis === 'x' ? anchor.rect.width : anchor.rect.height;
            const previous = anchors[index];
            const next = anchors[index + 1];
            const gap =
                next && previous
                    ? next.rect[axis] -
                      previous.rect[axis] -
                      (axis === 'x' ? previous.rect.width : previous.rect.height)
                    : 0;
            position += size + gap;
        });
    }
    function dropBounds(): Rect | null {
        const container = options.container()?.getBoundingClientRect();
        if (!container || !bounds) return null;
        if (axis === 'y') return container;
        const y = Math.max(container.y, bounds.y - 1);
        const bottom = Math.min(container.bottom, bounds.y + bounds.height + 1);
        return { x: container.x, y, width: container.width, height: Math.max(0, bottom - y) };
    }
    function placeDestination(rect: Rect) {
        const region = dropBounds();
        if (!destination || !marker || !region) return;
        const clip = options.destinationClip?.();
        if (clip) {
            const right = Math.min(region.x + region.width, clip.x + clip.width);
            const bottom = Math.min(region.y + region.height, clip.y + clip.height);
            region.x = Math.max(region.x, clip.x);
            region.y = Math.max(region.y, clip.y);
            region.width = Math.max(0, right - region.x);
            region.height = Math.max(0, bottom - region.y);
        }
        const host = destination.parentElement;
        if (!host) return;
        const hostRect = host.getBoundingClientRect();
        const computed = getComputedStyle(host);
        const scaleX = hostRect.width / parseFloat(computed.width) || 1;
        const scaleY = hostRect.height / parseFloat(computed.height) || 1;
        Object.assign(destination.style, {
            left: (region.x - hostRect.x) / scaleX + 'px',
            top: (region.y - hostRect.y) / scaleY + 'px',
            width: region.width / scaleX + 'px',
            height: region.height / scaleY + 'px',
        });
        Object.assign(marker.style, {
            width: rect.width / scaleX + 'px',
            height: rect.height / scaleY + 'px',
        });
        const position = { x: (rect.x - region.x) / scaleX, y: (rect.y - region.y) / scaleY };
        if (destination.hidden) gsap.set(marker, position);
        destination.hidden = false;
        gsap.to(marker, { ...position, duration: duration(), ease: 'power2.out', overwrite: true });
    }
    function movePreview(event: DragEvent) {
        if (!preview || phase.value !== 'dragging') return;
        cancelAnimationFrame(previewFrame);
        const x = event.clientX - pointerOffset.x;
        const y = event.clientY - pointerOffset.y;
        previewFrame = requestAnimationFrame(() => {
            previewFrame = 0;
            if (preview) gsap.set(preview, { x, y });
        });
    }
    function start(event: DragEvent, id: string) {
        cleanup();
        const source = (event.currentTarget as HTMLElement).closest<HTMLElement>(
            '[data-reorder-id]'
        );
        const root = options.root();
        if (!source || !root || !event.dataTransfer) return;
        const rect = source.getBoundingClientRect();
        const computed = getComputedStyle(source);
        dragging.value = id;
        phase.value = 'dragging';
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
        preview = document.createElement('div');
        surface = document.createElement('div');
        surface.append(...[...source.childNodes].map((node) => node.cloneNode(true)));
        surface.className = source.className;
        Object.assign(surface.style, {
            width: '100%',
            height: '100%',
            margin: '0',
            padding: computed.padding,
            font: computed.font,
            textAlign: computed.textAlign,
            background: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
        });
        preview.append(surface);
        preview.dataset.dragPreview = id;
        preview.dataset.dragPhase = 'dragging';
        preview.setAttribute('aria-hidden', 'true');
        preview.inert = true;
        Object.assign(preview.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            width: rect.width + 'px',
            height: rect.height + 'px',
            pointerEvents: 'none',
            zIndex: '2147483647',
        });
        preview.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
        document.body.append(preview);
        destination = document.createElement('div');
        marker = surface.cloneNode(true) as HTMLElement;
        destination.append(marker);
        destination.dataset.dragDestination = id;
        destination.setAttribute('aria-hidden', 'true');
        destination.inert = true;
        destination.hidden = true;
        Object.assign(destination.style, {
            position: 'absolute',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: '0',
        });
        Object.assign(marker.style, {
            position: 'absolute',
            opacity: '0.32',
            border: '1px dashed var(--muted-foreground)',
        });
        (options.destinationHost?.() ?? root).append(destination);
        pointerOffset = { x: event.clientX - rect.x, y: event.clientY - rect.y };
        previewSize = { width: rect.width, height: rect.height };
        gsap.set(preview, { x: rect.x, y: rect.y });
        gsap.fromTo(
            surface,
            { scale: 0.98, opacity: 0 },
            { scale: 1.01, opacity: 0.85, duration: duration() * 0.75, ease: 'power2.out' }
        );
        const transparent = document.createElement('canvas');
        transparent.width = transparent.height = 1;
        event.dataTransfer.setDragImage(transparent, 0, 0);
        measure();
        validDrop = true;
        moveItems(ids(), true);
        // Capture accepts every descendant and gap before native drop feedback is calculated.
        document.addEventListener('dragenter', over, true);
        document.addEventListener('dragover', over, true);
        document.addEventListener('drop', drop, true);
        document.addEventListener('scroll', scheduleLayout, true);
        window.addEventListener('resize', scheduleLayout);
        observer = new ResizeObserver(scheduleLayout);
        observer.observe(root);
    }
    function refreshLayout() {
        const rect = options.root()?.getBoundingClientRect();
        const previous = bounds;
        const changed =
            rect &&
            previous &&
            (['x', 'y', 'width', 'height'] as const).some(
                (key) => Math.abs(rect[key] - previous[key]) > 0.01
            );
        if (layoutFrame || changed) {
            cancelAnimationFrame(layoutFrame);
            layoutFrame = 0;
            measure();
            return true;
        }
        return false;
    }
    function inside(event: DragEvent) {
        const region = dropBounds();
        // Keep fractional CSS edges valid when native drag coordinates are rounded.
        return (
            region &&
            event.target instanceof Node &&
            options.container()?.contains(event.target) &&
            event.clientX >= Math.floor(region.x) &&
            event.clientX <= Math.ceil(region.x + region.width) &&
            event.clientY >= Math.floor(region.y) &&
            event.clientY <= Math.ceil(region.y + region.height)
        );
    }
    function insertion(event: DragEvent) {
        const source = dragging.value;
        if (!source) return null;
        const others = anchors.filter((anchor) => anchor.id !== source);
        const position =
            (axis === 'x' ? event.clientX - pointerOffset.x : event.clientY - pointerOffset.y) +
            (axis === 'x' ? previewSize.width : previewSize.height) / 2;
        const before = others.find(
            ({ rect }) => position < rect[axis] + (axis === 'x' ? rect.width : rect.height) / 2
        );
        const anchor = before ?? others.at(-1);
        if (!anchor) return null;
        const next = ids().filter((id) => id !== source);
        next.splice(next.indexOf(anchor.id) + (before ? 0 : 1), 0, source);
        return next;
    }
    function over(event: DragEvent) {
        if (phase.value !== 'dragging') return;
        movePreview(event);
        const changed = refreshLayout();
        validDrop = !!inside(event);
        if (!validDrop) {
            moveItems(ids());
            if (destination) destination.hidden = true;
            return;
        }
        event.preventDefault();
        moveItems(insertion(event) ?? ids(), changed || !!destination?.hidden);
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }
    function positions() {
        return new Map(
            anchors.map(({ id, rect }) => [id, rect[axis] + (motions.get(id)?.offset ?? 0) * scale])
        );
    }
    function settle(before: Map<string, number>) {
        const seconds = duration();
        const landing = gsap.timeline({ paused: true, onComplete: cleanup });
        timeline = landing;
        if (marker) gsap.killTweensOf(marker);
        if (destination) landing.to(destination, { opacity: 0, duration: seconds }, 0);
        anchors.forEach(({ id, rect }) => {
            const motion = motions.get(id) as Motion;
            gsap.killTweensOf(motion);
            motion.offset =
                id === dragging.value && !options.keepSourceVisible
                    ? 0
                    : ((before.get(id) ?? rect[axis]) - rect[axis]) / scale;
            motion.apply(motion.offset);
            landing.to(
                motion,
                {
                    offset: 0,
                    duration: seconds,
                    ease: 'power2.out',
                    onUpdate: () => motion.apply(motion.offset),
                },
                0
            );
        });
        const anchor = anchors.find(({ id }) => id === dragging.value);
        if (preview && surface && anchor) {
            preview.dataset.dragPhase = 'settling';
            gsap.killTweensOf(surface);
            landing.to(
                preview,
                {
                    x: anchor.rect.x,
                    y: anchor.rect.y,
                    duration: seconds,
                    ease: 'power2.out',
                },
                0
            );
            landing.to(surface, { scale: 1, duration: seconds, ease: 'power2.out' }, 0);
            const fade = Math.min(seconds, 0.06);
            landing.to(surface, { opacity: 0, duration: fade }, seconds - fade);
            landing.to(
                (motions.get(anchor.id) as Motion).elements,
                { opacity: 1, duration: fade },
                seconds - fade
            );
        }
        landing.play();
    }
    async function finish(next?: string[]) {
        if (phase.value !== 'dragging') return;
        phase.value = 'settling';
        cancelAnimationFrame(previewFrame);
        const token = revision;
        const before = positions();
        if (next) reorder(next);
        await nextTick();
        if (revision !== token) return;
        if (!options.root()?.isConnected) return cleanup();
        measure();
        settle(before);
    }
    function end() {
        void finish();
    }
    function drop(event: DragEvent) {
        if (phase.value !== 'dragging') return;
        refreshLayout();
        event.preventDefault();
        // Release uses the same geometry as the destination preview, including the grab offset.
        const next = inside(event) ? insertion(event) : null;
        moveItems(next ?? ids());
        void finish(next ?? undefined);
    }
    watch(
        () => [...ids()],
        async (next, previous) => {
            if (phase.value === 'dragging') return end();
            if (
                dragging.value ||
                sameOrder(next, previous) ||
                next.length !== previous.length ||
                next.some((id) => !previous.includes(id))
            )
                return;
            if (!options.root()?.isConnected) return;
            measure();
            const before = positions();
            cleanup();
            phase.value = 'settling';
            const token = revision;
            await nextTick();
            if (revision !== token || !options.root()?.isConnected) return;
            measure();
            settle(before);
        }
    );
    return { dragging, phase, start, end };
}
