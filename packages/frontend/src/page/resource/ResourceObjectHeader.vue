<script setup lang="ts">
import { computed, watchEffect, type Component } from 'vue';
import { ArrowLeft } from '@lucide/vue';
import { useRoute } from 'vue-router';
import { useNavigationStore } from '@/platform/navigation';
import { CopyableId } from '@/component/inspector';
import { StateBadge } from '@/component/state-badge';
import type { StateTone } from '@/component/state-badge';
import { stateTone } from '@/module/workbench';
import { Button } from '@/ui/button';
const props = defineProps<{
    title: string;
    id: string;
    icon: Component;
    backTo: string;
    backLabel: string;
    status?: string;
    statusTone?: StateTone;
    subtitle?: string;
}>();
const navigation = useNavigationStore();
const route = useRoute();
const origin = navigation.origin;
const backLabel = computed(() => origin?.label ?? props.backLabel);
watchEffect(() => navigation.setPageLabel(route.path, props.title));
</script>
<template>
    <header class="space-y-4">
        <Button variant="ghost" size="sm" class="-ml-2" @click="navigation.returnTo(origin, backTo)">
            <ArrowLeft aria-hidden="true" />
            {{ backLabel }}
        </Button>
        <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex min-w-0 flex-1 gap-4">
                <div class="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                    <component :is="icon" class="size-6" aria-hidden="true" />
                </div>
                <div class="min-w-0 space-y-2">
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h1 class="break-words text-xl font-semibold">{{ title }}</h1>
                        <StateBadge v-if="status" :tone="statusTone ?? stateTone(status)">{{ status }}</StateBadge>
                    </div>
                    <p v-if="subtitle" class="break-words text-sm text-muted-foreground">{{ subtitle }}</p>
                    <CopyableId :value="id" label="对象 ID" />
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-2"><slot /></div>
        </div>
        <slot name="summary" />
    </header>
</template>
