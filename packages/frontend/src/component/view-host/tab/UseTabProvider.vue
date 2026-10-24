<template>
    <slot :clear="clear" />
</template>

<script setup lang="ts">
import { useTabProvider } from './useTab';

const { clear } = useTabProvider();

defineSlots<{
    default(props: { clear: typeof clear }): any;
}>();
</script>

<style scoped></style>
