<script setup lang="ts">
import { computed } from 'vue';
import { ExternalLink, KeyRound } from '@lucide/vue';
import {
    useResourceAccessDataSource,
    useResourceAccessRead,
    assertGrantScope,
    type AccessScope,
} from '@/module/resource-access';
import { HttpError } from '@/platform/http';
import { SheetInspector } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';
import GrantContent from './GrantContent.vue';
import ReadFeedback from './ReadFeedback.vue';
const props = defineProps<{ id: string | null; scope: AccessScope; contextKey: string }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ detail: [resourceId: string] }>();
const source = useResourceAccessDataSource();
const key = computed(() =>
    source && open.value && props.id && props.contextKey ? JSON.stringify([props.contextKey, props.id]) : ''
);
const { data, loading, error, refresh } = useResourceAccessRead(key, async (signal) => {
    if (!source || !props.id) return;
    const id = props.id,
        scope = props.scope;
    const next = await source.grant(scope, id, signal);
    assertGrantScope(scope, next);
    if (next.id !== id) throw new HttpError('授权记录不匹配', 'protocol');
    return next;
});
</script>
<template>
    <SheetInspector v-model:open="open" title="授权记录预览" description="资源、授权主体与权限来源">
        <header class="flex shrink-0 items-center gap-3 border-b p-6 pr-12">
            <KeyRound class="size-5 shrink-0 text-primary" aria-hidden="true" />
            <h2 class="font-semibold">授权记录</h2>
        </header>
        <ScrollSurface class="min-h-0 flex-1" edge-effect="line">
            <div class="space-y-4 p-6">
                <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取授权记录</p>
                <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
                <GrantContent v-if="data" :grant="data" :scope="scope" />
            </div>
        </ScrollSurface>
        <footer v-if="data" class="shrink-0 border-t p-4">
            <Button class="w-full" @click="emit('detail', data.resource.id)">
                <ExternalLink aria-hidden="true" />
                查看资源授权详情
            </Button>
        </footer>
    </SheetInspector>
</template>
