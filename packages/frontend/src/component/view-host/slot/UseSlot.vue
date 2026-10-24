<template></template>

<script setup lang="ts">
import { useSlot, type UseSlotOptions } from './useSlot';
import { useSlots, defineComponent } from 'vue';
import { v7 as uuidv7 } from 'uuid';

const props = withDefaults(
    defineProps<{
        name: string;
        opts?: UseSlotOptions;
    }>(),
    {
        opts: () => ({
            id: uuidv7(),
            order: 0,
            enable: true,
            stable: false,
            keepAlive: true,
            namespace: undefined,
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
