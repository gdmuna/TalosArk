<script setup lang="ts">
import type { Component } from 'vue';
import { ArrowLeft } from '@lucide/vue';
import { useRouter } from 'vue-router';
import { CopyableId } from '@/component/inspector';
import { StateBadge } from '@/component/state-badge';
import { stateTone } from '@/module/workbench';
import { Button } from '@/ui/button';
defineProps<{ title: string; id: string; icon: Component; backTo: string; backLabel: string; status?: string }>();
const router = useRouter();
</script>
<template>
    <header class="space-y-4">
        <Button variant="ghost" size="sm" class="-ml-2" @click="router.push(backTo)">
            <ArrowLeft aria-hidden="true" />
            {{ backLabel }}
        </Button>
        <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex min-w-0 flex-1 gap-4">
                <div class="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                    <component :is="icon" class="size-6" aria-hidden="true" />
                </div>
                <div class="min-w-0 space-y-2">
                    <h1 class="break-words text-xl font-semibold">{{ title }}</h1>
                    <CopyableId :value="id" label="对象 ID" />
                    <StateBadge :tone="status ? stateTone(status) : 'neutral'">{{ status ?? '未加载' }}</StateBadge>
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-2"><slot /></div>
        </div>
    </header>
</template>
