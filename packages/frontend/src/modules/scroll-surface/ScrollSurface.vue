<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { reactiveOmit, useResizeObserver, useScroll } from '@vueuse/core';
import type { ScrollAreaRootProps } from 'reka-ui';
import { ScrollArea } from '@/ui/scroll-area';
import EdgeBoundary from './EdgeBoundary.vue';

const props = withDefaults(
    defineProps<
        ScrollAreaRootProps & {
            edgeEffect?: 'fade' | 'line' | 'none';
            edges?: 'vertical' | 'horizontal' | 'both';
            edgeSize?: number;
        }
    >(),
    { type: 'auto', edgeEffect: 'fade', edges: 'vertical' }
);
const emit = defineEmits<{ scroll: [event: Event] }>();
const delegated = reactiveOmit(props, 'edgeEffect', 'edges', 'edgeSize');
const area = useTemplateRef<InstanceType<typeof ScrollArea>>('area');
const viewportElement = computed(() => area.value?.viewportElement);
const content = computed(() => viewportElement.value?.firstElementChild as HTMLElement | undefined);
const { arrivedState, measure } = useScroll(viewportElement);
const verticalEdges = computed(() => props.edges !== 'horizontal');
const horizontalEdges = computed(() => props.edges !== 'vertical');
const edgeInset = computed(() =>
    props.edgeEffect === 'none' ? 0 : props.edgeEffect === 'line' ? 1 : (props.edgeSize ?? 16)
);

function refresh() {
    measure();
}
useResizeObserver([viewportElement, content], refresh);
defineExpose({ viewportElement, refresh });
</script>

<template>
    <div
        class="relative flex min-h-0 min-w-0 flex-col"
        data-slot="scroll-surface"
        :style="{
            '--scroll-surface-padding-block': (verticalEdges ? edgeInset : 0) + 'px',
            '--scroll-surface-padding-inline': (horizontalEdges ? edgeInset : 0) + 'px',
        }"
    >
        <ScrollArea ref="area" v-bind="delegated" class="min-h-0 flex-1" @scroll="emit('scroll', $event)">
            <slot />
            <template #overlay>
                <template v-if="edgeEffect !== 'none'">
                    <EdgeBoundary
                        v-if="verticalEdges"
                        side="top"
                        :effect="edgeEffect"
                        :size="edgeSize"
                        :active="!arrivedState.top"
                    />
                    <EdgeBoundary
                        v-if="verticalEdges"
                        side="bottom"
                        :effect="edgeEffect"
                        :size="edgeSize"
                        :active="!arrivedState.bottom"
                    />
                    <EdgeBoundary
                        v-if="horizontalEdges"
                        side="left"
                        :effect="edgeEffect"
                        :size="edgeSize"
                        :active="!arrivedState.left"
                    />
                    <EdgeBoundary
                        v-if="horizontalEdges"
                        side="right"
                        :effect="edgeEffect"
                        :size="edgeSize"
                        :active="!arrivedState.right"
                    />
                </template>
                <slot name="overlay" />
            </template>
        </ScrollArea>
    </div>
</template>

<style scoped>
:deep([data-slot='scroll-area-viewport']) {
    scroll-padding-block: var(--scroll-surface-padding-block);
    scroll-padding-inline: var(--scroll-surface-padding-inline);
}
</style>
