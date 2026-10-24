<script setup lang="ts">
import type { ListboxRootEmits, ListboxRootProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { ListboxRoot, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/shared/util/cn';
import { provideCommandContext } from './context';
import { useCommandIndex } from './useCommandIndex';

const props = withDefaults(defineProps<ListboxRootProps & { class?: HTMLAttributes['class'] }>(), {
    modelValue: '',
    highlightOnHover: true,
});

const emits = defineEmits<ListboxRootEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);

provideCommandContext(useCommandIndex());
</script>

<template>
    <ListboxRoot
        data-slot="command"
        v-bind="forwarded"
        :class="
            cn(
                'bg-popover text-popover-foreground flex min-h-0 w-full flex-col overflow-hidden rounded-lg',
                props.class
            )
        "
    >
        <slot />
    </ListboxRoot>
</template>
