<script setup lang="ts">
import type { ListboxItemEmits, ListboxItemProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';
import { reactiveOmit, useCurrentElement, useMutationObserver } from '@vueuse/core';
import { ListboxItem, useForwardPropsEmits, useId } from 'reka-ui';
import { computed, onUnmounted, ref, watch, watchEffect } from 'vue';
import { cn } from '@/shared/util/cn';
import { useCommand, useCommandGroup } from './context';

// Dynamic labels use textValue so their index can update while the item DOM is filtered out.
const props = defineProps<
    ListboxItemProps & { class?: HTMLAttributes['class']; textValue?: string; keywords?: string[] }
>();
const emits = defineEmits<ListboxItemEmits>();

const delegatedProps = reactiveOmit(props, 'class', 'textValue', 'keywords');

const forwarded = useForwardPropsEmits(delegatedProps, emits);

const id = useId();
const { filterState, updateItem, removeItem } = useCommand();
const groupContext = useCommandGroup(null);

const isRender = computed(() => {
    if (!filterState.search) {
        return true;
    } else {
        const filteredCurrentItem = filterState.filtered.items.get(id);
        // If the filtered items is undefined means not in the all times map yet
        // Do the first render to add into the map
        if (filteredCurrentItem === undefined) {
            return true;
        }

        // Check with filter
        return filteredCurrentItem > 0;
    }
});

const itemRef = ref();
const currentElement = useCurrentElement(itemRef);
const fallbackText = ref<string>();
function readText() {
    if (currentElement.value instanceof HTMLElement) fallbackText.value = currentElement.value.textContent ?? '';
}
watch(currentElement, readText, { flush: 'post' });
useMutationObserver(() => (props.textValue === undefined ? currentElement.value : undefined), readText, {
    childList: true,
    characterData: true,
    subtree: true,
});
// Explicit text stays reactive even when filtering unmounts the ListboxItem DOM.
watchEffect(
    () => {
        updateItem(
            id,
            [props.textValue ?? fallbackText.value ?? String(props.value), ...(props.keywords ?? [])].join(' '),
            groupContext?.id
        );
    },
    { flush: 'post' }
);
onUnmounted(() => removeItem(id));
</script>

<template>
    <ListboxItem
        v-if="isRender"
        v-bind="forwarded"
        :id="id"
        ref="itemRef"
        data-slot="command-item"
        :class="
            cn(
                'data-highlighted:bg-neutral-selected relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none **:is-[svg]:pointer-events-none **:is-[svg]:shrink-0 data-disabled:pointer-events-none data-disabled:opacity-50',
                props.class
            )
        "
        @select="
            () => {
                filterState.search = '';
            }
        "
    >
        <slot />
    </ListboxItem>
</template>
