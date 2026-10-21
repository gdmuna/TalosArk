<script setup lang="ts">
import { AlertCircle, LoaderCircle, RotateCw } from '@lucide/vue';
import { Button } from '@/ui/button';
import { useApplicationBootstrap } from './context';

const { state, start } = useApplicationBootstrap();
</script>

<template>
    <div data-slot="application-startup" class="flex size-full min-h-0 items-center justify-center bg-muted p-6">
        <div
            v-if="state.status === 'error' && state.error"
            role="alert"
            class="flex w-full max-w-sm flex-col items-center gap-3 text-center"
        >
            <AlertCircle class="size-6 text-destructive" aria-hidden="true" />
            <h1 class="text-lg font-medium">无法加载{{ state.stage }}</h1>
            <p class="w-full wrap-break-word text-sm text-muted-foreground">{{ state.error }}</p>
            <Button variant="outline" class="mt-1 gap-2" @click="start()">
                <RotateCw class="size-4" aria-hidden="true" />
                重新加载
            </Button>
        </div>
        <div
            v-else-if="state.status === 'loading' || state.status === 'idle'"
            role="status"
            aria-live="polite"
            class="flex items-center gap-2 text-sm text-muted-foreground"
        >
            <LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            正在加载{{ state.stage || '工作区' }}
        </div>
        <Button v-else-if="state.status === 'error'" variant="outline" @click="start()">重新加载</Button>
    </div>
</template>
