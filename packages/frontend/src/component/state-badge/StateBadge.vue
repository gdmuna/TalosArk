<script setup lang="ts">
import { Badge } from '@/ui/badge';
import type { StateTone } from './type';

withDefaults(defineProps<{ tone?: StateTone }>(), { tone: 'neutral' });
const tones = {
    primary: 'bg-primary-soft text-primary-soft-foreground',
    success: 'bg-success-soft text-success-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
    caution: 'bg-caution-soft text-caution-soft-foreground',
    destructive: 'bg-destructive-soft text-destructive-soft-foreground',
    neutral: 'bg-muted text-muted-foreground',
};
</script>

<template>
    <Badge
        variant="outline"
        :class="['h-6 shrink-0 rounded border-transparent px-2 py-0.5 text-xs font-medium', tones[tone]]"
    >
        <slot />
    </Badge>
</template>
