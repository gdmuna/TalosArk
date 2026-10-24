<script setup lang="ts">
import { ArrowRight, RotateCw } from '@lucide/vue';
import { RouterLink } from 'vue-router';
import { Button } from '@/ui/button';
import type { OverviewReadStatus } from '../../model/overview';

defineProps<{
    title: string;
    status: OverviewReadStatus;
    error: string;
    empty: boolean;
    emptyLabel: string;
    path: string;
}>();
defineEmits<{ refresh: [] }>();
</script>

<template>
    <section :aria-label="title" :aria-busy="status === 'loading'">
        <header class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-semibold">{{ title }}</h2>
            <div class="flex items-center gap-1">
                <slot name="actions" />
                <Button
                    variant="ghost"
                    size="icon-sm"
                    :aria-label="`重新加载${title}`"
                    :disabled="status === 'loading' || status === 'unavailable' || status === 'idle'"
                    @click="$emit('refresh')"
                >
                    <RotateCw class="size-3.5" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="sm" as-child>
                    <RouterLink :to="path">
                        查看全部
                        <ArrowRight class="size-3.5" aria-hidden="true" />
                    </RouterLink>
                </Button>
            </div>
        </header>
        <div
            v-if="status !== 'ready' || empty"
            class="flex min-h-40 flex-col items-center justify-center gap-3 border-y px-4 py-6 text-center text-sm text-muted-foreground"
            role="status"
        >
            <template v-if="status === 'loading'">正在加载…</template>
            <template v-else-if="status === 'idle'">请先选择工作区</template>
            <template v-else-if="status === 'unavailable'">此数据来源尚未接入</template>
            <template v-else-if="status === 'ready'">{{ emptyLabel }}</template>
            <template v-else-if="error">
                <p>{{ error }}</p>
                <Button variant="outline" size="sm" @click="$emit('refresh')">重新加载</Button>
            </template>
        </div>
        <slot v-else />
    </section>
</template>
