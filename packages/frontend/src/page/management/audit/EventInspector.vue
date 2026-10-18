<script setup lang="ts">
import { computed } from 'vue';
import { ClipboardList, ExternalLink } from '@lucide/vue';
import { useAuditDataSource, useAuditRead, assertAuditScope, type AuditScope } from '@/module/audit';
import { SheetInspector } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';
import EventContent from './EventContent.vue';

const props = defineProps<{ id: string | null; scope: AuditScope; identity: string }>();
const emit = defineEmits<{ detail: [id: string] }>();
const open = defineModel<boolean>('open', { required: true });
const source = useAuditDataSource();
const key = computed(() =>
    source && open.value && props.id && props.identity ? JSON.stringify([props.identity, props.scope, props.id]) : ''
);
const { data, loading, error, refresh } = useAuditRead(key, async (signal) => {
    if (!source || !props.id) return;
    const event = await source.event(props.scope, props.id, signal);
    assertAuditScope(props.scope, [event]);
    return event;
});
</script>

<template>
    <SheetInspector v-model:open="open" title="审计事件预览" description="审计事件事实与关联资源">
        <header class="flex shrink-0 items-center gap-3 border-b p-6 pr-12">
            <ClipboardList class="size-5 shrink-0 text-primary" aria-hidden="true" />
            <h2 class="break-words font-semibold">{{ data?.actionLabel ?? '审计事件' }}</h2>
        </header>
        <ScrollSurface class="min-h-0 flex-1" edge-effect="line">
            <div class="space-y-4 p-6">
                <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在加载审计事件</p>
                <div v-if="error" role="alert" class="space-y-3 text-sm text-destructive">
                    <p>{{ error }}{{ data ? '，当前保留上次读取结果。' : '' }}</p>
                    <Button variant="outline" size="sm" @click="refresh">重新加载</Button>
                </div>
                <EventContent v-if="data" :event="data" />
            </div>
        </ScrollSurface>
        <footer v-if="data" class="shrink-0 border-t p-4">
            <Button class="w-full" @click="emit('detail', data.id)">
                <ExternalLink aria-hidden="true" />
                查看完整详情
            </Button>
        </footer>
    </SheetInspector>
</template>
