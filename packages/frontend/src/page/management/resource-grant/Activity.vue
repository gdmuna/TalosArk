<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ExternalLink } from '@lucide/vue';
import type { AccessScope } from '@/module/resource-access';
import { useAuditDataSource, useAuditRead, assertAuditScope } from '@/module/audit';
import { HttpError } from '@/platform/http';
import { Button } from '@/ui/button';
import EventInspector from '../audit/EventInspector.vue';
import ReadFeedback from './ReadFeedback.vue';
import { accessDate } from './presentation';
const props = defineProps<{ scope: AccessScope; resourceId: string; contextKey: string; identity: string }>();
const source = useAuditDataSource();
const key = computed(() => (source && props.contextKey ? JSON.stringify([props.contextKey, props.resourceId]) : ''));
const { data, loading, error, refresh } = useAuditRead(key, async (signal) => {
    if (!source) return;
    const scope = props.scope,
        resourceId = props.resourceId;
    const page = await source.list(scope, { resourceId, limit: 20 }, signal);
    assertAuditScope(scope, page.items);
    if (page.items.some((item) => !item.resources.some((resource) => resource.resourceId === resourceId)))
        throw new HttpError('审计响应资源不匹配', 'protocol');
    return page;
});
const selected = ref<string | null>(null),
    open = ref(false);
watch(
    key,
    () => {
        selected.value = null;
        open.value = false;
    },
    { flush: 'sync' }
);
watch(data, (value) => {
    if (!value?.items.some((item) => item.id === selected.value)) open.value = false;
});
</script>
<template>
    <div class="space-y-4">
        <p v-if="!source" role="status" class="text-sm text-muted-foreground">资源审计查询服务尚未开放</p>
        <template v-else>
            <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取操作记录</p>
            <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
            <p v-if="data && !data.items.length" class="text-sm text-muted-foreground">当前范围没有相关操作记录</p>
            <ul v-if="data?.items.length" class="divide-y">
                <li v-for="event in data.items" :key="event.id">
                    <button
                        class="flex w-full flex-wrap items-start justify-between gap-3 py-4 text-left hover:bg-muted/50"
                        @click="
                            selected = event.id;
                            open = true;
                        "
                    >
                        <span class="min-w-0 space-y-1">
                            <span class="block break-words font-medium">{{ event.actionLabel }}</span>
                            <span class="block break-words text-sm text-muted-foreground">
                                {{ event.actor?.name ?? '操作者信息不可用' }}
                            </span>
                        </span>
                        <time class="text-sm text-muted-foreground" :datetime="event.occurredAt">
                            {{ accessDate(event.occurredAt) }}
                        </time>
                    </button>
                </li>
            </ul>
            <Button v-if="data" variant="outline" as-child>
                <RouterLink
                    :to="{
                        path: '/main/management/audit-log',
                        query: {
                            organization: scope.organizationId,
                            workspace: scope.workspaceId,
                            resource: resourceId,
                        },
                    }"
                >
                    <ExternalLink aria-hidden="true" />
                    查看审计日志
                </RouterLink>
            </Button>
        </template>
    </div>
    <EventInspector
        :id="selected"
        v-model:open="open"
        :scope="scope"
        :identity="contextKey ? identity : ''"
        @detail="
            $router.push({
                path: `/main/management/audit-log/${encodeURIComponent($event)}`,
                query: { organization: scope.organizationId, workspace: scope.workspaceId },
            })
        "
    />
</template>
