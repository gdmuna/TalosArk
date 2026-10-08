<script setup lang="ts">
import { computed } from 'vue';
import { HardDrive, KeyRound, Network, Webhook, Settings } from '@lucide/vue';
import { Button } from '@/ui/button';
import { DataTable } from '@/component/data-table';
import ManagementPage from './component/ManagementPage.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import IntegrationDetail from './component/IntegrationDetail.vue';
import { useManagementView } from './useManagementView';
import { column, type ManagementRow } from './table';

const integrations = [
    { id: 'storage', name: '文件存储', icon: HardDrive },
    { id: 'identity', name: '身份服务', icon: KeyRound },
    { id: 'gateway', name: '设备网关', icon: Network },
    { id: 'webhook', name: 'Webhook', icon: Webhook },
];
const views = [
    { value: 'management', label: '集成管理' },
    { value: 'log', label: '集成日志' },
];
const view = useManagementView(views);
const selectedId = useManagementView(
    integrations.map((item) => ({ value: item.id, label: item.name })),
    'integration'
);
const selected = computed(() => integrations.find((item) => item.id === selectedId.value) ?? integrations[0]);
const logs: ManagementRow[] = [];
const logColumns = [
    column('occurredAt', '时间', 220),
    column('integration', '集成', 200),
    column('event', '事件', 280),
    column('result', '结果', 140),
];
</script>

<template>
    <ManagementPage title="集成" :layout="view === 'log' ? 'table' : 'wide'">
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="集成视图" /></template>
        <div v-if="view === 'management'" class="grid items-start gap-6 @4xl:grid-cols-[280px_minmax(0,1fr)]">
            <div class="grid grid-cols-2 gap-3 @4xl:grid-cols-1" aria-label="集成类型">
                <article
                    v-for="integration in integrations"
                    :key="integration.id"
                    class="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4"
                    :class="selected.id === integration.id && 'border-primary/40'"
                >
                    <div class="flex items-center gap-3">
                        <component :is="integration.icon" class="size-5 text-muted-foreground" aria-hidden="true" />
                        <h2 class="font-semibold">{{ integration.name }}</h2>
                    </div>
                    <p class="text-sm text-muted-foreground">状态未加载</p>
                    <Button
                        variant="outline"
                        class="mt-auto w-full"
                        :aria-pressed="selected.id === integration.id"
                        aria-controls="integration-detail"
                        @click="selectedId = integration.id"
                    >
                        <Settings aria-hidden="true" />
                        配置详情
                    </Button>
                </article>
            </div>
            <IntegrationDetail :integration="selected" />
        </div>
        <DataTable
            v-else
            :data="logs"
            :columns="logColumns"
            search-label="搜索集成或事件"
            empty-text="集成日志尚未加载"
        />
    </ManagementPage>
</template>
