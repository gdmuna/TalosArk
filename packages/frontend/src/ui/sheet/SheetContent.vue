<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { X } from '@lucide/vue';
import { reactiveOmit } from '@vueuse/core';
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/shared/util/cn';
import SheetOverlay from './SheetOverlay.vue';
import { Button } from '@/ui/button';
import { useOverlayContainer } from '@/shared/browser/overlay-container';

interface SheetContentProps extends DialogContentProps {
    class?: HTMLAttributes['class'];
    side?: 'top' | 'right' | 'bottom' | 'left';
}

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(defineProps<SheetContentProps>(), {
    side: 'right',
});
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = reactiveOmit(props, 'class', 'side');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
const { container: overlayContainer, onInteractOutside } = useOverlayContainer();
</script>

<template>
    <DialogPortal :to="overlayContainer ?? undefined">
        <SheetOverlay />
        <DialogContent
            data-slot="sheet-content"
            :class="
                cn(
                    'pointer-events-auto bg-card data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-standard data-[state=closed]:duration-200 data-[state=open]:duration-250',
                    side === 'right' &&
                        'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
                    side === 'left' &&
                        'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
                    side === 'top' &&
                        'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
                    side === 'bottom' &&
                        'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
                    props.class,
                    overlayContainer && side !== 'bottom' && 'top-[var(--overlay-chrome-height)]',
                    overlayContainer && (side === 'right' || side === 'left') && 'h-auto'
                )
            "
            v-bind="{ ...$attrs, ...forwarded }"
            @interact-outside="onInteractOutside"
        >
            <slot />

            <DialogClose
                as-child
                class="ring-offset-background focus:ring-ring data-[state=open]:bg-neutral-selected absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            >
                <Button variant="ghost" size="icon-sm" use-tooltip class="size-6" aria-label="关闭详情">
                    <X class="size-4" />
                </Button>
            </DialogClose>
        </DialogContent>
    </DialogPortal>
</template>
