import { inject, provide, type InjectionKey, type Ref } from 'vue';

const overlayContainerKey: InjectionKey<Ref<HTMLElement | null>> = Symbol('overlay-container');

export function provideOverlayContainer(container: Ref<HTMLElement | null>) {
    provide(overlayContainerKey, container);
}

export function useOverlayContainer() {
    const container = inject(overlayContainerKey, undefined);
    function onInteractOutside(event: CustomEvent<{ originalEvent: PointerEvent | FocusEvent }>) {
        const target = event.detail.originalEvent.target;
        if (container?.value && target instanceof Node && !container.value.contains(target))
            event.preventDefault();
    }
    return { container, onInteractOutside };
}
