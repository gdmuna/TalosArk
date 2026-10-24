<script setup lang="ts">
import { Button } from '@/ui/button';
defineProps<{ error?: string; loading?: boolean; stale?: boolean }>();
defineEmits<{ retry: [] }>();
</script>
<template>
    <div v-if="error" role="alert" class="space-y-2 text-sm">
        <p class="text-destructive">{{ error }}</p>
        <p v-if="stale" class="text-muted-foreground">当前显示上次读取结果</p>
        <Button variant="outline" size="sm" :disabled="loading" @click="$emit('retry')">重新加载</Button>
    </div>
</template>
