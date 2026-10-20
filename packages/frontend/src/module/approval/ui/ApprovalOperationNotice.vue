<script setup lang="ts">
import { computed } from 'vue';
import { RotateCw } from '@lucide/vue';
import { Button } from '@/ui/button';
import { useApprovalOperationStore } from '../model/operation';
import { useApprovalScope } from '../model/read';
const emit = defineEmits<{ synchronize: [] }>();
const store = useApprovalOperationStore(),
    scope = useApprovalScope();
const attempt = computed(() => store.current(scope.value));
async function recover() {
    if (!scope.value) return;
    if (!attempt.value?.result) await store.recover(scope.value);
    if (attempt.value?.result) emit('synchronize');
}
</script>
<template>
    <div
        v-if="attempt || store.error || store.recoveryError"
        role="status"
        class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-4 text-sm"
    >
        <div class="min-w-0 space-y-1">
            <p v-if="attempt" class="font-medium">
                {{ attempt.result ? '操作已成功，等待同步页面' : '原操作结果尚未确认' }}
            </p>
            <p v-if="attempt && !attempt.result" class="text-muted-foreground">核对原请求后再继续，避免重复提交。</p>
            <p v-if="store.error || store.recoveryError" class="text-destructive">
                {{ store.recoveryError || store.error }}
            </p>
        </div>
        <Button v-if="attempt" variant="outline" :disabled="store.busy" @click="recover">
            <RotateCw aria-hidden="true" />
            {{ store.busy ? '正在核对' : attempt.result ? '只重新加载' : '继续核对原操作' }}
        </Button>
    </div>
</template>
