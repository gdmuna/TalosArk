<template>
    <Button variant="ghost" :disabled="!canNavigateBack" class="size-7" @click="syncBack(contextId)">
        <slot name="back" />
    </Button>
    <Button variant="ghost" :disabled="!canNavigateForward" class="size-7" @click="syncForward(contextId)">
        <slot name="forward" />
    </Button>
</template>

<script setup lang="ts">
import { Button } from '@/ui/button';
import { useViewHistory } from './useViewHistory';
import { computed } from 'vue';

interface Props {
    contextId: string;
}

const props = withDefaults(defineProps<Props>(), {});

const { syncBack, canBack, syncForward, canForward } = useViewHistory();

const contextId = computed(() => props.contextId);
const canNavigateBack = canBack(contextId);
const canNavigateForward = canForward(contextId);
</script>

<style scoped></style>
