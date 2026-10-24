<template>
    <slot :clear="clear" />
</template>

<script setup lang="ts">
import { useSlotProvider } from './useSlot';

const { clear } = useSlotProvider();

defineSlots<{
    default(props: { clear: typeof clear }): any;
}>();
</script>
