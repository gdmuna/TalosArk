<script setup lang="ts">
import type { ListboxItemEmits, ListboxItemProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';
import { reactiveOmit, useCurrentElement } from '@vueuse/core';
import { ListboxItem, useForwardPropsEmits, useId } from 'reka-ui';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { cn } from '@/shared/util/cn';
import { useCommand, useCommandGroup } from './context';

const props = defineProps<ListboxItemProps & { class?: HTMLAttributes['class']; keywords?: string[] }>();
const emits = defineEmits<ListboxItemEmits>();

const delegatedProps = reactiveOmit(props, 'class', 'keywords');

const forwarded = useForwardPropsEmits(delegatedProps, emits);

const id = useId();
const { filterState, allItems, allGroups } = useCommand();
const groupContext = useCommandGroup();

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
onMounted(() => {
    if (!(currentElement.value instanceof HTMLElement)) return;

    // textValue to perform filter
    allItems.value.set(
        id,
        [currentElement.value.textContent ?? String(props.value), ...(props.keywords ?? [])].join(' ')
    );

    const groupId = groupContext?.id;
    if (groupId) {
        if (!allGroups.value.has(groupId)) {
            allGroups.value.set(groupId, new Set([id]));
        } else {
            allGroups.value.get(groupId)?.add(id);
        }
    }
});
onUnmounted(() => {
    allItems.value.delete(id);
    const groupId = groupContext?.id;
    if (groupId) allGroups.value.get(groupId)?.delete(id);
});
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
