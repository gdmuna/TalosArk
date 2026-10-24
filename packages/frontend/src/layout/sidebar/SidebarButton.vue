<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue';
import { useForwardExpose } from 'reka-ui';
import { Button } from '@/ui/button';
import { cn } from '@/shared/util/cn';

defineOptions({ inheritAttrs: false });
const props = defineProps<{
    label: string;
    icon: Component;
    collapsed: boolean;
    tooltip?: string;
    class?: HTMLAttributes['class'];
}>();
const { forwardRef } = useForwardExpose();
</script>

<template>
    <Button
        :ref="forwardRef"
        v-bind="$attrs"
        variant="ghost"
        :class="cn('w-full justify-start gap-0 overflow-hidden px-0', props.class)"
        :title="label"
        :aria-label="label"
        use-tooltip
        :tooltip-disabled="!collapsed"
        :tooltip="tooltip ?? label"
        tooltip-side="right"
        :tooltip-delay-duration="0"
    >
        <span class="flex h-9 basis-10 shrink-0 items-center justify-center">
            <slot name="icon"><component :is="icon" class="size-5 fill-none" aria-hidden="true" /></slot>
        </span>
        <span
            class="min-w-0 truncate text-left transition-opacity duration-(--sidebar-transition-duration) ease-standard"
            :class="collapsed && 'opacity-0'"
            :aria-hidden="collapsed"
        >
            {{ label }}
        </span>
    </Button>
</template>
