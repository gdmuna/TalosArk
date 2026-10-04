<script setup lang="ts">
import type { CollapsibleContentProps } from 'reka-ui';
import { CollapsibleContent } from 'reka-ui';

const props = defineProps<CollapsibleContentProps>();
</script>

<template>
    <CollapsibleContent data-slot="collapsible-content" class="collapsible-content" v-bind="props">
        <slot />
    </CollapsibleContent>
</template>

<style scoped>
.collapsible-content {
    overflow: hidden;
}
.collapsible-content[data-state='open'] {
    animation: collapsible-down 150ms var(--ease-standard);
}
.collapsible-content[data-state='closed'] {
    animation: collapsible-up 150ms var(--ease-standard);
}
@keyframes collapsible-down {
    from {
        height: 0;
        opacity: 0;
    }
    to {
        height: var(--reka-collapsible-content-height);
        opacity: 1;
    }
}
@keyframes collapsible-up {
    from {
        height: var(--reka-collapsible-content-height);
        opacity: 1;
    }
    to {
        height: 0;
        opacity: 0;
    }
}
</style>
