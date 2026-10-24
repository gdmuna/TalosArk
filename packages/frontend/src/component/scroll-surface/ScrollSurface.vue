<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { reactiveOmit, useResizeObserver, useScroll } from '@vueuse/core';
import type { ScrollAreaRootProps } from 'reka-ui';
import { ScrollArea } from '@/ui/scroll-area';
import EdgeBoundary from './EdgeBoundary.vue';

type EdgeSide = 'top' | 'bottom' | 'left' | 'right';

const props = withDefaults(
    defineProps<
        ScrollAreaRootProps & {
            edgeEffect?: 'fade' | 'line' | 'none';
            edges?: 'vertical' | 'horizontal' | 'both' | readonly EdgeSide[];
            edgeSize?: number;
            focusInset?: number | Partial<Record<EdgeSide, number>>;
        }
    >(),
    { type: 'auto', edgeEffect: 'fade', edges: 'vertical', focusInset: 0 }
);
const emit = defineEmits<{ scroll: [event: Event] }>();
const delegated = reactiveOmit(props, 'edgeEffect', 'edges', 'edgeSize', 'focusInset');
const area = useTemplateRef<InstanceType<typeof ScrollArea>>('area');
const viewportElement = computed(() => area.value?.viewportElement);
const content = computed(() => viewportElement.value?.firstElementChild as HTMLElement | undefined);
const { arrivedState, measure } = useScroll(viewportElement);
const enabledEdges = computed<readonly EdgeSide[]>(() => {
    if (typeof props.edges !== 'string') return props.edges;
    if (props.edges === 'vertical') return ['top', 'bottom'];
    if (props.edges === 'horizontal') return ['left', 'right'];
    return ['top', 'bottom', 'left', 'right'];
});
const edgeInset = computed(() =>
    props.edgeEffect === 'none' ? 0 : props.edgeEffect === 'line' ? 1 : (props.edgeSize ?? 16)
);

function scrollPadding(side: EdgeSide) {
    const focusInset = typeof props.focusInset === 'number' ? props.focusInset : (props.focusInset[side] ?? 0);
    return (enabledEdges.value.includes(side) ? edgeInset.value : 0) + focusInset + 'px';
}
const viewportStyle = computed(() => ({
    scrollPaddingTop: scrollPadding('top'),
    scrollPaddingBottom: scrollPadding('bottom'),
    scrollPaddingLeft: scrollPadding('left'),
    scrollPaddingRight: scrollPadding('right'),
}));

function refresh() {
    measure();
}
useResizeObserver([viewportElement, content], refresh);
defineExpose({ viewportElement, refresh });
</script>

<template>
    <div class="relative flex min-h-0 min-w-0 flex-col" data-slot="scroll-surface">
        <ScrollArea
            ref="area"
            v-bind="delegated"
            :viewport-style="viewportStyle"
            class="min-h-0 flex-1"
            @scroll="emit('scroll', $event)"
        >
            <slot />
            <template #overlay>
                <template v-if="edgeEffect !== 'none'">
                    <EdgeBoundary
                        v-for="side in enabledEdges"
                        :key="side"
                        :side="side"
                        :effect="edgeEffect"
                        :size="edgeSize"
                        :active="!arrivedState[side]"
                    />
                </template>
                <slot name="overlay" />
            </template>
        </ScrollArea>
    </div>
</template>
