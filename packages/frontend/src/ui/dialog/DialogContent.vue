<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { X } from '@lucide/vue';
import { reactiveOmit } from '@vueuse/core';
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/shared/util/cn';
import DialogOverlay from './DialogOverlay.vue';
import { Button } from '@/ui/button';
import { useOverlayContainer } from '@/shared/browser/overlay-container';

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(
    defineProps<DialogContentProps & { class?: HTMLAttributes['class']; showCloseButton?: boolean }>(),
    {
        showCloseButton: true,
    }
);
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
const { container: overlayContainer, onInteractOutside } = useOverlayContainer();
</script>

<template>
    <DialogPortal :to="overlayContainer ?? undefined">
        <DialogOverlay />
        <DialogContent
            data-slot="dialog-content"
            v-bind="{ ...$attrs, ...forwarded }"
            :class="
                cn(
                    'pointer-events-auto bg-card data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[calc(50%+var(--overlay-chrome-height,0px)/2)] left-[50%] z-50 grid w-full max-h-[calc(100dvh-var(--overlay-chrome-height,0px)-2rem)] max-w-[calc(100%-2rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 ease-standard sm:max-w-lg',
                    props.class
                )
            "
            @interact-outside="onInteractOutside"
        >
            <slot />

            <DialogClose
                v-if="showCloseButton"
                as-child
                data-slot="dialog-close"
                class="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
                <Button variant="ghost" size="icon-sm" use-tooltip class="size-6" aria-label="关闭对话框"><X /></Button>
            </DialogClose>
        </DialogContent>
    </DialogPortal>
</template>
