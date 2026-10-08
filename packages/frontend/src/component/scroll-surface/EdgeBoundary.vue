<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';

const props = withDefaults(
    defineProps<{
        side: 'top' | 'bottom' | 'left' | 'right';
        effect?: 'fade' | 'line';
        active?: boolean;
        size?: number;
    }>(),
    { effect: 'fade', active: true, size: 16 }
);
const style = computed<CSSProperties>(() => {
    const horizontal = props.side === 'left' || props.side === 'right';
    const extent = `${props.effect === 'line' ? 1 : props.size}px`;
    const direction = { top: 'to top', bottom: 'to bottom', left: 'to left', right: 'to right' }[props.side];
    const surface = 'var(--edge-surface, var(--background))';
    return {
        [props.side]: 0,
        ...(horizontal ? { top: 0, bottom: 0, width: extent } : { left: 0, right: 0, height: extent }),
        background:
            props.effect === 'line'
                ? 'var(--edge-line, var(--border))'
                : `linear-gradient(${direction},
                    transparent 0%,
                    color-mix(in srgb, ${surface} 8%, transparent) 20%,
                    color-mix(in srgb, ${surface} 32%, transparent) 40%,
                    color-mix(in srgb, ${surface} 68%, transparent) 60%,
                    color-mix(in srgb, ${surface} 92%, transparent) 80%,
                    ${surface} 100%)`,
        opacity: props.active ? 1 : 0,
    };
});
</script>

<template>
    <div
        aria-hidden="true"
        data-slot="edge-boundary"
        :data-side="side"
        :data-effect="effect"
        :data-active="active"
        class="pointer-events-none absolute z-20 transition-opacity duration-150 motion-reduce:transition-none"
        :style="style"
    />
</template>
