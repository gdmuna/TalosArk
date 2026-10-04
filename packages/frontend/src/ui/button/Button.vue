<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui';
import { computed, ref, useAttrs, type HTMLAttributes } from 'vue';
import type { ButtonVariants } from './variants';
import { Primitive, useForwardExpose } from 'reka-ui';
import { cn } from '@/shared/lib/utils';
import { buttonVariants } from './variants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

defineOptions({ inheritAttrs: false });

interface Props extends PrimitiveProps {
    variant?: ButtonVariants['variant'];
    size?: ButtonVariants['size'];
    class?: HTMLAttributes['class'];
    title?: string;
    tooltip?: string;
    useTooltip?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    as: 'button',
    useTooltip: false,
});
const attrs = useAttrs();
const { forwardRef } = useForwardExpose();
const tooltipOpen = ref(false);
const tooltipText = computed(() =>
    props.useTooltip === false ? '' : (props.tooltip ?? props.title ?? String(attrs['aria-label'] ?? ''))
);
</script>

<template>
    <Tooltip v-if="tooltipText" v-model:open="tooltipOpen" :ignore-non-keyboard-focus="true" :delay-duration="300">
        <TooltipTrigger as-child>
            <Primitive
                :ref="forwardRef"
                v-bind="attrs"
                data-slot="button"
                :data-variant="variant"
                :data-size="size"
                :as="as"
                :as-child="asChild"
                :aria-label="attrs['aria-label'] ?? tooltipText"
                :class="cn(buttonVariants({ variant, size }), props.class)"
                @dragstart="tooltipOpen = false"
            >
                <slot />
            </Primitive>
        </TooltipTrigger>
        <TooltipContent :aria-label="tooltipText" class="duration-200 ease-standard">{{ tooltipText }}</TooltipContent>
    </Tooltip>
    <Primitive
        v-else
        :ref="forwardRef"
        v-bind="attrs"
        data-slot="button"
        :data-variant="variant"
        :data-size="size"
        :as="as"
        :as-child="asChild"
        :title="title"
        :class="cn(buttonVariants({ variant, size }), props.class)"
    >
        <slot />
    </Primitive>
</template>
