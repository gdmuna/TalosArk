<script setup lang="ts">
import { computed } from 'vue';
import { Building2, ExternalLink } from '@lucide/vue';
import { useFacilityDataSource, useFacilityRead, assertFacilityDetail, type FacilityScope } from '@/module/facility';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';
import FacilityFacts from './FacilityFacts.vue';
import ReadFeedback from './ReadFeedback.vue';
const props = withDefaults(
    defineProps<{
        id: string | null;
        scope: FacilityScope;
        contextKey: string;
        organizationName?: string;
        showDetail?: boolean;
    }>(),
    { showDetail: true }
);
const open = defineModel<boolean>('open', { required: true });
defineEmits<{ detail: [id: string] }>();
const source = useFacilityDataSource();
const key = computed(() =>
    source && open.value && props.contextKey && props.id ? JSON.stringify([props.contextKey, props.id]) : ''
);
const { data, loading, error, refresh } = useFacilityRead(key, async (signal) => {
    if (!source || !props.id) return;
    const scope = props.scope,
        id = props.id;
    const result = await source.detail(scope, id, signal);
    assertFacilityDetail(scope, id, result);
    return result;
});
</script>
<template>
    <SheetInspector v-model:open="open" title="设施预览" description="设施身份、归属和基础资料">
        <header class="space-y-3 border-b p-6 pr-12">
            <Building2 class="size-6 text-primary" aria-hidden="true" />
            <h2 class="break-words text-lg font-semibold">{{ data?.name ?? '设施预览' }}</h2>
            <CopyableId v-if="data" :value="data.id" label="设施 ID" />
        </header>
        <ScrollSurface class="min-h-0 flex-1" edge-effect="line">
            <div class="space-y-5 p-6">
                <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取设施</p>
                <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
                <FacilityFacts v-if="data" :data="data" :organization-name="organizationName" />
            </div>
        </ScrollSurface>
        <footer v-if="data && showDetail" class="border-t p-4">
            <Button class="w-full" @click="$emit('detail', data.id)">
                <ExternalLink aria-hidden="true" />
                详情
            </Button>
        </footer>
    </SheetInspector>
</template>
