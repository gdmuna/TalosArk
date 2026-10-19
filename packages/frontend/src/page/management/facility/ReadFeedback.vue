<script setup lang="ts">
import { Button } from '@/ui/button';
defineProps<{ error: string; loading: boolean; stale?: boolean }>();
defineEmits<{ retry: [] }>();
</script>
<template>
    <div v-if="error" role="alert" class="flex flex-wrap items-center gap-3 text-sm text-destructive">
        <span>
            {{ error }}
            <template v-if="stale">；当前显示上次读取结果</template>
        </span>
        <Button variant="outline" size="sm" :disabled="loading" @click="$emit('retry')">重新加载</Button>
    </div>
</template>
