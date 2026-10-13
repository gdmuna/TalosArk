<script setup lang="ts">
import type { ScrollAreaRootProps } from 'reka-ui';
import { computed, useTemplateRef, type HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui';
import { cn } from '@/shared/util/cn';
import ScrollBar from './ScrollBar.vue';

const props = defineProps<
    ScrollAreaRootProps & {
        class?: HTMLAttributes['class'];
        viewportStyle?: HTMLAttributes['style'];
    }
>();

const delegatedProps = reactiveOmit(props, 'class', 'viewportStyle');
const emit = defineEmits<{ scroll: [event: Event] }>();
const viewport = useTemplateRef<InstanceType<typeof ScrollAreaViewport>>('viewport');
const viewportElement = computed(() => viewport.value?.viewportElement);
defineExpose({ viewportElement });
</script>

<template>
    <ScrollAreaRoot
        data-slot="scroll-area"
        v-bind="delegatedProps"
        :class="cn('relative flex min-h-0 flex-col', props.class)"
    >
        <ScrollAreaViewport
            ref="viewport"
            data-slot="scroll-area-viewport"
            class="focus-visible:ring-ring/50 min-h-0 size-full flex-1 scroll-smooth rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-3 focus-visible:outline-1 motion-reduce:scroll-auto"
            :style="viewportStyle"
            @scroll="emit('scroll', $event)"
        >
            <slot />
        </ScrollAreaViewport>
        <ScrollBar />
        <ScrollAreaCorner />
        <slot name="overlay" />
    </ScrollAreaRoot>
</template>
