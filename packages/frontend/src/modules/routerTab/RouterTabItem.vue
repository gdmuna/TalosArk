<template>
    <Button
        variant="ghost"
        type="button"
        class="h-12 w-auto max-w-48 shrink-0 rounded-none border-b-2 border-transparent px-2.5 text-base text-muted-foreground hover:bg-transparent data-[active=false]:hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-primary"
        :title="label"
        :disabled="disabled"
    >
        <span class="truncate">{{ label }}</span>
    </Button>
</template>

<script setup lang="ts">
import { Button } from '@/ui/button';

interface Props {
    label?: string;
    disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
    label: 'unknown',
    disabled: false,
});
</script>

<style scoped></style>
