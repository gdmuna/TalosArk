<script setup lang="ts">
import type { ListboxFilterProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';
import { SearchIcon } from '@lucide/vue';
import { reactiveOmit } from '@vueuse/core';
import { ListboxFilter, useForwardProps } from 'reka-ui';
import { cn } from '@/shared/util/cn';
import { useCommand } from './context';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<
    ListboxFilterProps & {
        class?: HTMLAttributes['class'];
    }
>();

const delegatedProps = reactiveOmit(props, 'class');

const forwardedProps = useForwardProps(delegatedProps);

const { filterState } = useCommand();
</script>

<template>
    <div data-slot="command-input-wrapper" class="flex items-center gap-3 px-4">
        <SearchIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <ListboxFilter
            v-bind="{ ...forwardedProps, ...$attrs }"
            v-model="filterState.search"
            data-slot="command-input"
            auto-focus
            :class="
                cn(
                    'h-12 w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
                    props.class
                )
            "
        />
    </div>
</template>
