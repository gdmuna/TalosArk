<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ClipboardList } from '@lucide/vue';
import { useAccountStore } from '@/module/account';
import { useAuditDataSource, useAuditRead, assertAuditScope } from '@/module/audit';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { CopyableId } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';
import { useNavigationStore } from '@/platform/navigation';
import { auditListPath, useAuditQuery } from './query';
import EventContent from './EventContent.vue';

const route = useRoute(),
    router = useRouter(),
    navigation = useNavigationStore(),
    account = useAccountStore(),
    source = useAuditDataSource();
const id = computed(() => String(route.params.eventId ?? ''));
const { scope, invalid, key: contextKey } = useAuditQuery(computed(() => account.profile?.id ?? ''));
const key = computed(() =>
    source && contextKey.value && id.value && route.path.startsWith(`${auditListPath}/`)
        ? `${contextKey.value}:${id.value}`
        : ''
);
const { data, loading, error, refresh } = useAuditRead(key, async (signal) => {
    if (!source) return;
    const event = await source.event(scope.value, id.value, signal);
    assertAuditScope(scope.value, [event]);
    return event;
});
const title = computed(() => data.value?.actionLabel ?? '审计事件详情');
const listTo = computed(() => {
    const last = navigation.lastLocation(auditListPath);
    const previous = router.resolve(last).query;
    if (previous.organization === scope.value.organizationId && previous.workspace === scope.value.workspaceId)
        return last;
    return router.resolve({
        path: auditListPath,
        query: { organization: scope.value.organizationId, workspace: scope.value.workspaceId },
    }).fullPath;
});
watchEffect(() => navigation.setPageLabel(route.path, title.value));
provideBreadcrumbs(() => [
    { id: 'management', label: '管理中心', to: '/main/management' },
    { id: 'audit', label: '审计日志', to: listTo.value },
    { id: 'event', label: title.value },
]);
</script>

<template>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col" data-slot="audit-detail">
        <ScrollSurface class="min-h-0 flex-1" edge-effect="line">
            <header class="shrink-0 space-y-4 border-b p-4 lg:p-6">
                <Button variant="ghost" size="sm" class="-ml-2" @click="navigation.returnTo(navigation.origin, listTo)">
                    <ArrowLeft aria-hidden="true" />
                    {{ navigation.origin?.label ?? '审计日志' }}
                </Button>
                <div class="flex min-w-0 items-start gap-4">
                    <div
                        class="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"
                    >
                        <ClipboardList class="size-6" aria-hidden="true" />
                    </div>
                    <div class="min-w-0 space-y-2">
                        <h1 class="break-words text-xl font-semibold">{{ title }}</h1>
                        <CopyableId :value="id" label="事件 ID" />
                    </div>
                </div>
            </header>
            <main class="@container mx-auto w-full max-w-[1328px] space-y-6 p-4 lg:p-6" :aria-label="title">
                <p v-if="!source" role="status" class="text-sm text-muted-foreground">审计查询服务尚未开放</p>
                <p v-else-if="invalid || !scope.organizationId" role="alert" class="text-sm text-destructive">
                    {{ invalid || '缺少组织上下文，请从审计日志重新进入' }}
                </p>
                <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在加载审计事件</p>
                <div v-if="error" role="alert" class="flex flex-wrap items-center gap-3 text-sm text-destructive">
                    {{ error }}{{ data ? '，当前保留上次读取结果。' : '' }}
                    <Button variant="outline" size="sm" @click="refresh">重新加载</Button>
                </div>
                <EventContent v-if="data" :event="data" />
            </main>
        </ScrollSurface>
    </div>
</template>
