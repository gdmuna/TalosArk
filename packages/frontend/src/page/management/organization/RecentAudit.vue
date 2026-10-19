<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ChevronRight, RotateCw } from '@lucide/vue';
import { useAuditDataSource, useAuditRead, assertAuditScope } from '@/module/audit';
import { Button } from '@/ui/button';
import { formatDateTime } from '@/shared/util/date-time';
import ManagementSection from '../component/ManagementSection.vue';
import ManagementEmpty from '../component/ManagementEmpty.vue';
import EventInspector from '../audit/EventInspector.vue';
import { auditListPath } from '../audit/query';

const props = defineProps<{ organizationId: string; identity: string; contextKey: string }>();
const router = useRouter();
const source = useAuditDataSource();
const scope = computed(() => ({ organizationId: props.organizationId }));
const key = computed(() => (source ? props.contextKey : ''));
const { data, loading, error, refresh } = useAuditRead(key, async (signal) => {
    if (!source) return;
    const selection = scope.value;
    const page = await source.list(selection, { limit: 20 }, signal);
    assertAuditScope(selection, page.items);
    return page;
});
const records = computed(() => data.value?.items.slice(0, 5) ?? []);
const previewId = ref<string | null>(null);
const previewOpen = ref(false);
watch([key, data], () => {
    if (!data.value?.items.some((item) => item.id === previewId.value)) previewOpen.value = false;
});
function openDetail(id: string) {
    previewOpen.value = false;
    void router.push({
        path: `${auditListPath}/${encodeURIComponent(id)}`,
        query: { organization: props.organizationId },
    });
}
</script>

<template>
    <ManagementSection title="最近审计">
        <template #actions>
            <RouterLink
                :to="{ path: auditListPath, query: { organization: organizationId } }"
                class="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
                查看日志
                <ChevronRight class="size-4" aria-hidden="true" />
            </RouterLink>
        </template>
        <ManagementEmpty v-if="!source" text="审计查询服务尚未开放" compact />
        <template v-else>
            <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在加载审计记录</p>
            <div v-if="error" role="alert" class="flex flex-wrap items-center gap-2 text-sm text-destructive">
                <span>{{ error }}{{ data ? '，当前保留上次读取结果。' : '' }}</span>
                <Button variant="outline" size="sm" :disabled="loading" @click="refresh">
                    <RotateCw aria-hidden="true" />
                    重试
                </Button>
            </div>
            <ul v-if="records.length" class="divide-y">
                <li v-for="record in records" :key="record.id">
                    <button
                        class="group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left"
                        @click="
                            previewId = record.id;
                            previewOpen = true;
                        "
                    >
                        <span class="min-w-0 space-y-1">
                            <span
                                class="block break-words font-medium group-hover:underline group-focus-visible:underline"
                            >
                                {{ record.actionLabel }}
                            </span>
                            <span class="block break-words text-xs text-muted-foreground">
                                {{ record.actor?.name ?? '操作者信息不可用' }} ·
                                {{
                                    record.resources.map((item) => item.labelSnapshot).join('、') ||
                                    record.workspace?.name ||
                                    '组织级事件'
                                }}
                            </span>
                            <time :datetime="record.occurredAt" class="block text-xs text-muted-foreground">
                                {{ formatDateTime(Date.parse(record.occurredAt)) }}
                            </time>
                        </span>
                        <ChevronRight class="size-4 text-muted-foreground" aria-hidden="true" />
                    </button>
                </li>
            </ul>
            <ManagementEmpty v-else-if="data && !loading && !error" text="当前组织暂无可见审计记录" compact />
        </template>
    </ManagementSection>
    <EventInspector
        :id="previewId"
        v-model:open="previewOpen"
        :scope="scope"
        :identity="identity"
        @detail="openDetail"
    />
</template>
