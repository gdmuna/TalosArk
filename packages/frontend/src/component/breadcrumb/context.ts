import { computed, onScopeDispose, watchEffect, type InjectionKey } from 'vue';
import { injectLocal, provideLocal } from '@vueuse/core';
import { useUiContextStore } from '@/component/view-context';
import type { BreadcrumbEntry } from './type';

type Layer = { depth: number; entries: BreadcrumbEntry[] };
type BreadcrumbContext = { layers: Map<symbol, Layer>; depth: number };
const key: InjectionKey<BreadcrumbContext> = Symbol('BreadcrumbContext');

export function provideBreadcrumbContext(fallback: () => BreadcrumbEntry[]) {
    const scope = useUiContextStore().createBreadcrumbLayers<Layer>();
    const layers = scope.state.layers;
    provideLocal(key, { layers, depth: 0 });
    onScopeDispose(scope.dispose);
    return computed(() =>
        layers.size
            ? [...layers.values()]
                  .sort((a, b) => a.depth - b.depth)
                  .flatMap((layer) => layer.entries)
            : fallback()
    );
}

export function provideBreadcrumbs(entries: () => BreadcrumbEntry[]) {
    const parent = injectLocal(key);
    if (!parent) throw new Error('Breadcrumb provider is missing');
    const id = Symbol('BreadcrumbLayer');
    const depth = parent.depth + 1;
    provideLocal(key, { layers: parent.layers, depth });
    watchEffect(() => parent.layers.set(id, { depth, entries: entries() }));
    onScopeDispose(() => parent.layers.delete(id));
}
