<script setup lang="ts">
import { computed } from 'vue';
import { useAuditDataSource, useAuditRead, assertAuditScope } from '@/module/audit';
import { HttpError } from '@/platform/http';
import { Button } from '@/ui/button';
import ReadFeedback from './ReadFeedback.vue';
import { facilityDate } from './context';
const props = defineProps<{ organizationId: string; resourceId: string; contextKey: string }>();
const source = useAuditDataSource();
const key = computed(() => (source && props.contextKey ? JSON.stringify([props.contextKey, props.resourceId]) : ''));
const { data, loading, error, refresh } = useAuditRead(key, async (signal) => {
    if (!source) return;
    const scope = { organizationId: props.organizationId },
        resourceId = props.resourceId;
    const result = await source.list(scope, { resourceId, limit: 5 }, signal);
    assertAuditScope(scope, result.items);
    if (result.items.some((item) => !item.resources.some((resource) => resource.resourceId === resourceId)))
        throw new HttpError('设施活动资源不匹配', 'protocol');
    return result;
});
</script>
<template>
    <div class="space-y-4">
        <p v-if="!source" role="status" class="text-sm text-muted-foreground">设施活动查询尚未开放</p>
        <template v-else>
            <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取设施活动</p>
            <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
            <p v-if="data && !data.items.length" class="text-sm text-muted-foreground">没有可展示的设施活动</p>
            <ul v-if="data?.items.length" class="divide-y">
                <li v-for="item in data.items" :key="item.id" class="space-y-2 py-3">
                    <Button variant="link" class="h-auto max-w-full whitespace-normal p-0 text-left" as-child>
                        <RouterLink
                            :to="{
                                path: `/main/management/audit-log/${encodeURIComponent(item.id)}`,
                                query: { organization: organizationId },
                            }"
                        >
                            {{ item.actionLabel }}
                        </RouterLink>
                    </Button>
                    <p class="break-words text-xs text-muted-foreground">
                        {{ item.actor?.name ?? '操作者信息不可用' }} · {{ facilityDate(item.occurredAt) }}
                    </p>
                </li>
            </ul>
            <Button v-if="data" variant="outline" size="sm" as-child>
                <RouterLink
                    :to="{
                        path: '/main/management/audit-log',
                        query: { organization: organizationId, resource: resourceId },
                    }"
                >
                    查看审计日志
                </RouterLink>
            </Button>
        </template>
    </div>
</template>
