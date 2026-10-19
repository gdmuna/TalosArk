<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Calendar, Activity, CircleCheck, TextAlignStart, ChevronRight } from '@lucide/vue';
import {
    useIntegrationDataSource,
    useIntegrationRead,
    readIntegrationLogPage,
    type IntegrationLogQuery,
    type IntegrationLogPage,
} from '@/module/integration';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import ManagementReadFeedback from '../component/ManagementReadFeedback.vue';
import { integrationTime } from './presentation';

const props = defineProps<{
    context: { accountId: string; organizationId: string };
    id: string;
    kind: 'activity' | 'sync';
}>();
const route = useRoute();
const router = useRouter();
const source = useIntegrationDataSource();
const invalid = computed(
    () =>
        route.query.cursor !== undefined &&
        (typeof route.query.cursor !== 'string' || !route.query.cursor || route.query.cursor.length > 2048)
);
const query = computed<IntegrationLogQuery>(() => ({
    kind: props.kind,
    limit: 50,
    cursor: typeof route.query.cursor === 'string' ? route.query.cursor : null,
}));
const key = computed(() =>
    source && props.id && !invalid.value ? JSON.stringify([props.context, props.id, query.value]) : ''
);
const { data, loading, error, refresh } = useIntegrationRead(key, async (signal) => {
    const context = props.context;
    const id = props.id;
    const selected = query.value;
    if (!source) return;
    return readIntegrationLogPage(
        context.organizationId,
        id,
        selected,
        await source.logs(context.organizationId, id, selected, signal)
    );
});
const pagination = ref({ pageIndex: 0, pageSize: 50 });
type LogEntry = IntegrationLogPage['items'][number];
const resultLabel = { succeeded: '成功', failed: '失败', pending: '处理中', unknown: '结果未知' };
const columns: DataTableColumn<LogEntry>[] = [
    {
        id: 'time',
        label: '时间',
        icon: Calendar,
        size: 185,
        sortable: false,
        value: (row) => integrationTime(row.occurredAt),
    },
    { id: 'event', label: '事件', icon: Activity, size: 200, sortable: false, value: (row) => row.eventLabel },
    {
        id: 'result',
        label: '结果',
        icon: CircleCheck,
        size: 110,
        sortable: false,
        value: (row) => resultLabel[row.result],
    },
    {
        id: 'summary',
        label: '说明',
        icon: TextAlignStart,
        size: 280,
        fill: true,
        sortable: false,
        value: (row) => row.summary ?? '未提供',
    },
];
function move(cursor?: string) {
    void router.replace({ path: route.path, query: { ...route.query, cursor }, hash: route.hash });
}
</script>

<template>
    <div class="min-w-0 space-y-4">
        <p v-if="invalid" role="alert" class="text-sm text-destructive">日志游标无效，请返回首批</p>
        <ManagementReadFeedback :loading="loading" :error="error" :stale="!!data" @retry="refresh" />
        <DataTable
            v-model:pagination="pagination"
            :data="data?.items ?? []"
            :columns="columns"
            :busy="loading"
            :filtering="false"
            :searchable="false"
            :empty-text="loading ? '正在读取集成记录' : invalid ? '日志游标无效' : error || '此集成暂无记录'"
        >
            <template #cell-result="{ row }">
                <StateBadge
                    :tone="row.result === 'failed' ? 'destructive' : row.result === 'succeeded' ? 'success' : 'neutral'"
                >
                    {{ resultLabel[row.result] }}
                </StateBadge>
            </template>
            <template #footer>
                <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span class="text-muted-foreground">
                        {{ data ? `本批 ${data.items.length} 项` : '尚未取得记录' }}
                    </span>
                    <div class="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            :disabled="loading || (!query.cursor && !invalid)"
                            @click="move()"
                        >
                            返回首批
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            :disabled="loading || !!error || !data?.nextCursor"
                            @click="move(data?.nextCursor ?? undefined)"
                        >
                            下一批
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            </template>
        </DataTable>
    </div>
</template>
