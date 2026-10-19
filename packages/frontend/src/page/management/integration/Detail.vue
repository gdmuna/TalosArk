<script setup lang="ts">
import { computed } from 'vue';
import { RotateCw, ShieldCheck } from '@lucide/vue';
import { useIntegrationDataSource, useIntegrationRead, readIntegrationDetail } from '@/module/integration';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import { useQuerySelection } from '@/platform/navigation';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/ui/table';
import ManagementViewNav from '../component/ManagementViewNav.vue';
import ManagementSection from '../component/ManagementSection.vue';
import ManagementReadFeedback from '../component/ManagementReadFeedback.vue';
import { integrationIcon, integrationOwner, integrationState, integrationTime } from './presentation';
import IntegrationLog from './Log.vue';

const props = defineProps<{ context: { accountId: string; organizationId: string }; id: string }>();
const source = useIntegrationDataSource();
const views = [
    { value: 'basic', label: '基本信息' },
    { value: 'configuration', label: '配置信息' },
    { value: 'event', label: '事件类型' },
    { value: 'sync', label: '同步记录' },
];
const { value: selection, select: selectView } = useQuerySelection(
    views.map((item) => item.value),
    'detail'
);
const view = computed({
    get: () => selection.value,
    set: (detail: string) => void selectView(detail, { cursor: undefined }),
});
const key = computed(() => (source && props.id ? JSON.stringify([props.context, props.id]) : ''));
const { data, loading, error, refresh } = useIntegrationRead(key, async (signal) => {
    const context = props.context;
    const id = props.id;
    if (!source) return;
    return readIntegrationDetail(context.organizationId, id, await source.detail(context.organizationId, id, signal));
});
const configuration = computed(() => data.value?.configuration);
</script>

<template>
    <section id="integration-detail" class="min-w-0 space-y-5" aria-label="集成详情">
        <ManagementReadFeedback :loading="loading" :error="error" :stale="!!data" @retry="refresh" />
        <template v-if="data">
            <header class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex min-w-0 gap-3">
                    <div
                        class="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                    >
                        <component :is="integrationIcon(data.kind)" class="size-6" aria-hidden="true" />
                    </div>
                    <div class="min-w-0 space-y-2">
                        <h2 class="break-words text-lg font-semibold">{{ data.name }}</h2>
                        <div class="flex flex-wrap items-center gap-2">
                            <StateBadge :tone="integrationState[data.state].tone">
                                {{ integrationState[data.state].label }}
                            </StateBadge>
                            <span class="text-xs text-muted-foreground">{{ integrationOwner[data.owner] }}</span>
                        </div>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    use-tooltip
                    tooltip="刷新集成详情"
                    :disabled="loading"
                    @click="refresh"
                >
                    <RotateCw aria-hidden="true" />
                </Button>
            </header>
            <ManagementViewNav v-model="view" :items="views" label="集成详情视图" class="border-b" />
            <ManagementSection v-if="view === 'basic'" title="基本信息">
                <dl
                    class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-4 text-sm [&>dd]:break-words [&>dt]:text-muted-foreground"
                >
                    <dt>类型标识</dt>
                    <dd>{{ data.kind }}</dd>
                    <dt>说明</dt>
                    <dd>{{ data.description ?? '未提供' }}</dd>
                    <dt>状态说明</dt>
                    <dd>{{ data.stateReason ?? '未提供' }}</dd>
                    <dt>最近探测</dt>
                    <dd>{{ integrationTime(data.checkedAt) }}</dd>
                    <dt>最近同步</dt>
                    <dd>{{ integrationTime(data.lastSynchronizedAt) }}</dd>
                    <dt>创建时间</dt>
                    <dd>{{ integrationTime(data.createdAt) }}</dd>
                    <dt>创建人</dt>
                    <dd>{{ data.createdByLabel ?? '未提供' }}</dd>
                </dl>
            </ManagementSection>
            <ManagementSection v-else-if="view === 'configuration'" title="连接配置摘要">
                <p v-if="!configuration" class="text-sm text-muted-foreground">未提供可公开的配置摘要</p>
                <template v-else>
                    <p class="text-sm">
                        {{
                            configuration.availability === 'available'
                                ? '配置摘要可用'
                                : configuration.availability === 'unavailable'
                                  ? '配置摘要不可用'
                                  : '配置状态未知'
                        }}
                    </p>
                    <p v-if="configuration.reason" class="break-words text-sm text-muted-foreground">
                        {{ configuration.reason }}
                    </p>
                    <dl
                        class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-4 text-sm [&>dd]:break-words [&>dt]:text-muted-foreground"
                    >
                        <dt>服务提供方</dt>
                        <dd>{{ configuration.providerLabel ?? '未提供' }}</dd>
                        <dt>认证材料</dt>
                        <dd>
                            {{
                                configuration.credentialConfigured === null
                                    ? '未提供'
                                    : configuration.credentialConfigured
                                      ? '已配置'
                                      : '未配置'
                            }}
                        </dd>
                        <dt>传输加密</dt>
                        <dd>
                            {{
                                configuration.encryptedTransport === null
                                    ? '未提供'
                                    : configuration.encryptedTransport
                                      ? '已启用'
                                      : '未启用'
                            }}
                        </dd>
                    </dl>
                </template>
                <p class="flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldCheck class="size-4 shrink-0" aria-hidden="true" />
                    {{
                        data.owner === 'deployment' ? '部署连接由部署管理员维护。' : '组织连接配置当前只读。'
                    }}凭据不在此处显示。
                </p>
            </ManagementSection>
            <ManagementSection v-else-if="view === 'event'" title="事件类型">
                <p v-if="data.events === null" class="text-sm text-muted-foreground">此集成未提供事件目录</p>
                <div v-else class="min-w-0 overflow-hidden rounded-md border">
                    <Table class="min-w-[560px] table-fixed">
                        <TableHeader>
                            <TableRow>
                                <TableHead class="w-[38%]">事件</TableHead>
                                <TableHead class="w-[42%]">说明</TableHead>
                                <TableHead class="w-[20%]">订阅</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-for="event in data.events" :key="event.code">
                                <TableCell class="whitespace-normal break-words">
                                    <p>{{ event.label }}</p>
                                    <p class="text-xs text-muted-foreground">{{ event.code }}</p>
                                </TableCell>
                                <TableCell class="whitespace-normal break-words text-muted-foreground">
                                    {{ event.description ?? '未提供' }}
                                </TableCell>
                                <TableCell>
                                    <StateBadge :tone="event.enabled ? 'success' : 'neutral'">
                                        {{ event.enabled === null ? '未提供' : event.enabled ? '已启用' : '未启用' }}
                                    </StateBadge>
                                </TableCell>
                            </TableRow>
                            <TableRow v-if="!data.events.length">
                                <TableCell :colspan="3" class="h-28 text-center text-muted-foreground">
                                    没有已注册的事件
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </ManagementSection>
            <IntegrationLog v-else :id="id" :context="context" kind="sync" />
            <p class="text-xs text-muted-foreground">读取于 {{ integrationTime(data.measuredAt) }}</p>
        </template>
    </section>
</template>
