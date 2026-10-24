<script setup lang="ts">
import { RefreshCw, TriangleAlert } from '@lucide/vue';
import { Button } from '@/ui/button';

defineProps<{ scope: string; error: string; busy: boolean; pending?: boolean }>();
defineEmits<{ retry: [] }>();
</script>

<template>
    <div
        v-if="error"
        role="status"
        class="flex flex-wrap items-start gap-3 border border-warning/30 bg-warning-soft p-3 text-sm text-warning-soft-foreground"
    >
        <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div class="min-w-0 flex-1">
            <p>{{ scope }}操作已成功，数据尚未同步。重新同步后可继续操作。</p>
            <p class="mt-1 break-words text-xs">{{ error }}</p>
        </div>
        <Button type="button" variant="outline" size="sm" :disabled="busy" @click="$emit('retry')">
            <RefreshCw class="size-4" :class="busy && 'animate-spin'" aria-hidden="true" />
            {{ busy ? '正在同步' : '重新同步' }}
        </Button>
    </div>
    <Button v-else-if="pending" type="button" variant="outline" size="sm" :disabled="busy" @click="$emit('retry')">
        <RefreshCw class="size-4" :class="busy && 'animate-spin'" aria-hidden="true" />
        重新加载
    </Button>
</template>
