<template>
    <Button
        class="bg-card text-card-foreground data-[activated=true]:bg-secondary data-[activated=true]:hover:bg-secondary rounded-none p-0 hover:bg-accent"
    >
        <div class="flex shrink-0 min-h-8 max-w-max items-center gap-2 px-2 py-1">
            <p class="truncate max-w-32">
                <slot />
            </p>
            <Button variant="ghost" class="size-5 p-2!" use-tooltip tooltip="关闭标签页" @click.stop="$emit('close')">
                <X class="size-3.5" />
            </Button>
        </div>
    </Button>
</template>

<script setup lang="ts">
import { Button } from '@/ui/button';
import { X } from '@lucide/vue';

// interface Props {
//     label: string;
// }

// withDefaults(defineProps<Props>(), {});

defineEmits<{
    close: [];
}>();
</script>

<style scoped></style>
