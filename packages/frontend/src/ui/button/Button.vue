<script setup lang="ts">
import type { PrimitiveProps, TooltipContentProps } from 'reka-ui';
import { computed, ref, useAttrs, watch, type HTMLAttributes } from 'vue';
import type { ButtonVariants } from './variant';
import { Primitive, useForwardExpose } from 'reka-ui';
import { cn } from '@/shared/util/cn';
import { buttonVariants } from './variant';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

defineOptions({ inheritAttrs: false });

interface Props extends PrimitiveProps {
    variant?: ButtonVariants['variant'];
    size?: ButtonVariants['size'];
    class?: HTMLAttributes['class'];
    title?: string;
    tooltip?: string;
    useTooltip?: boolean;
    // Suspend the tooltip without replacing the trigger DOM.
    tooltipDisabled?: boolean;
    tooltipSide?: TooltipContentProps['side'];
    tooltipDelayDuration?: number;
}

const props = withDefaults(defineProps<Props>(), {
    as: 'button',
    useTooltip: false,
    tooltipDisabled: undefined,
    tooltipSide: 'top',
    tooltipDelayDuration: 300,
});
const attrs = useAttrs();
const { forwardRef } = useForwardExpose();
const tooltipOpen = ref(false);
const tooltipText = computed(() =>
    props.useTooltip === false ? '' : (props.tooltip ?? props.title ?? String(attrs['aria-label'] ?? ''))
);
watch(
    () => props.tooltipDisabled,
    (disabled) => {
        if (disabled) tooltipOpen.value = false;
    }
);
</script>

<template>
    <Tooltip
        v-if="tooltipText"
        v-model:open="tooltipOpen"
        :disabled="tooltipDisabled"
        :ignore-non-keyboard-focus="true"
        :disable-hoverable-content="true"
        :delay-duration="tooltipDelayDuration"
    >
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
        <TooltipContent
            v-if="tooltipOpen"
            data-button-tooltip
            :aria-label="tooltipText"
            :side="tooltipSide"
            class="pointer-events-none! duration-200 ease-standard z-20000"
        >
            {{ tooltipText }}
        </TooltipContent>
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

<style scoped>
/* Display-only labels must not block controls beneath their positioning wrapper. */
:global([data-reka-popper-content-wrapper]:has(> [data-button-tooltip])) {
    pointer-events: none;
}
</style>
