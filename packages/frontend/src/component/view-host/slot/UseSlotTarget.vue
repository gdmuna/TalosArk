<template>
    <template v-for="entity in slotEntity" v-if="!disabled" :key="entity.id">
        <keep-alive v-if="entity.keepAlive">
            <component :is="entity.component" v-if="isActive(entity)" />
        </keep-alive>
        <template v-else>
            <component :is="entity.component" v-if="isActive(entity)" />
        </template>
    </template>
</template>

<script setup lang="ts">
import { useTab } from '../tab/useTab';
import { useSlotTarget, type SlotContextEntity, type UseSlotSortCompareFn } from './useSlot';

interface Props {
    name: string;
    namespace?: string;
    disabled?: boolean;
    sortCompareFn?: UseSlotSortCompareFn;
    isActiveFn?: (entity: SlotContextEntity) => boolean;
}

const props = withDefaults(defineProps<Props>(), {});

const { slotEntity } = useSlotTarget(props.name, props.namespace, props.sortCompareFn);

const { activeTabId } = useTab();

const isActive = (entity: SlotContextEntity) => {
    if (props.isActiveFn) {
        return props.isActiveFn(entity);
    }
    return entity.enable && (entity.stable || entity.tabId === activeTabId.value);
};
</script>
