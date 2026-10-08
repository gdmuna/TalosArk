<script setup lang="ts">
import { ref } from 'vue';
import { CircleHelp } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
const open = ref(false);
</script>

<template>
    <Tooltip
        v-model:open="open"
        :disable-closing-trigger="true"
        :ignore-non-keyboard-focus="true"
        :delay-duration="300"
    >
        <TooltipTrigger as-child>
            <Button
                variant="ghost"
                size="icon-sm"
                class="size-6 shrink-0 text-muted-foreground"
                aria-label="表格视图设置说明"
                @click.stop.prevent="open = !open"
            >
                <CircleHelp class="size-3.5" aria-hidden="true" />
            </Button>
        </TooltipTrigger>
        <TooltipContent class="max-w-48 text-wrap">这些视图设置仅对你生效，不会影响工作区中的其他用户。</TooltipContent>
    </Tooltip>
</template>
