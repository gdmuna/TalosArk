<script setup lang="ts">
import { Button } from '@/ui/button';

defineProps<{ loading: boolean; error: string; stale?: boolean }>();
defineEmits<{ retry: [] }>();
</script>

<template>
    <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取</p>
    <div v-if="error" role="alert" class="flex flex-wrap items-center gap-3 text-sm text-destructive">
        <span>{{ error }}{{ stale ? '；当前显示上次结果，可能已过期。' : '' }}</span>
        <Button variant="outline" size="sm" :disabled="loading" @click="$emit('retry')">重新加载</Button>
    </div>
</template>
