<template></template>

<script setup lang="ts">
import { useSlot, type UseSlotOptions } from './useSlot';
import { useSlots, defineComponent } from 'vue';

const props = withDefaults(
    defineProps<{
        name: string;
        opts?: UseSlotOptions;
    }>(),
    {
        opts: () => ({
            order: 0,
            enable: true,
            stable: true,
            keepAlive: false,
        }),
    }
);

const slots = useSlots();

const Component = defineComponent({
    render() {
        return slots.default ? slots.default() : null;
    },
});

useSlot(props.name, Component, props.opts);
</script>
