<template>
    <div class="flex flex-col h-svh min-w-4xl bg-muted">
        <header class="shrink-0 flex h-10 items-center justify-between">
            <div class="flex items-center justify-between ml-4.5 gap-1 text-md">
                <Box class="fill-primary text-muted size-7.5" stroke-width="2.25" />
                <span class="font-medium">璇玑云库</span>
            </div>
            <div class="flex items-center justify-between h-full *:h-full *:w-12 *:rounded-none">
                <Button variant="ghost" size="sm" class="p-1" title="最小化">
                    <span class="sr-only">最小化</span>
                    <Minus class="size-5" stroke-width="1.5" />
                </Button>
                <Button variant="ghost" size="sm" class="p-1" :title="windowState !== 'maximize' ? '最大化' : '还原'">
                    <template v-if="windowState !== 'maximize'">
                        <span class="sr-only">最大化</span>
                        <Square class="size-3.5" stroke-width="1.5" />
                    </template>
                    <template v-else>
                        <span class="sr-only">还原</span>
                        <Copy class="size-3.5 -scale-x-100" stroke-width="1.5" />
                    </template>
                </Button>
                <Button variant="ghost" size="sm" class="p-1 hover:bg-red-600 group" title="关闭">
                    <span class="sr-only">关闭</span>
                    <X
                        class="size-4.5 group-hover:text-primary-foreground transition-colors ease-standard"
                        stroke-width="1.5"
                    />
                </Button>
            </div>
        </header>
        <RouterView />
    </div>
</template>

<script setup lang="ts">
import { Button } from '@/ui/button';

import { ref } from 'vue';

import { X, Square, Minus, Box, Copy } from '@lucide/vue';

const windowState = ref<'minimize' | 'maximize' | 'normal'>('maximize');
</script>

<style scoped></style>
