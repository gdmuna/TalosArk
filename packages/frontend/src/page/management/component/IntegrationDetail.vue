<script setup lang="ts">
import { Button } from '@/ui/button';
import { DataTable } from '@/component/data-table';
import ManagementViewNav from './ManagementViewNav.vue';
import ManagementSection from './ManagementSection.vue';
import ManagementField from './ManagementField.vue';
import ManagementEmpty from './ManagementEmpty.vue';
import { useManagementView } from '../useManagementView';
import { column, type ManagementRow } from '../table';

defineProps<{ integration: { id: string; name: string } }>();
const views = [
    { value: 'basic', label: '基本信息' },
    { value: 'configuration', label: '配置信息' },
    { value: 'event', label: '事件类型' },
    { value: 'sync', label: '同步记录' },
];
const view = useManagementView(views, 'detail');
const rows: ManagementRow[] = [];
const columns = [column('occurredAt', '同步时间', 220), column('event', '事件', 260), column('result', '结果', 140)];
</script>

<template>
    <section id="integration-detail" class="min-w-0 space-y-4" :aria-label="`${integration.name}详情`">
        <h2 class="text-base font-semibold">{{ integration.name }}</h2>
        <ManagementViewNav v-model="view" :items="views" label="集成详情视图" class="border-b" />
        <ManagementSection v-if="view === 'basic'" title="基本信息">
            <dl class="grid grid-cols-[140px_minmax(0,1fr)] gap-4">
                <dt class="text-muted-foreground">集成类型</dt>
                <dd>{{ integration.name }}</dd>
                <dt class="text-muted-foreground">状态</dt>
                <dd>未加载</dd>
                <dt class="text-muted-foreground">最近同步时间</dt>
                <dd>—</dd>
                <dt class="text-muted-foreground">创建时间</dt>
                <dd>—</dd>
                <dt class="text-muted-foreground">创建人</dt>
                <dd>—</dd>
            </dl>
        </ManagementSection>
        <ManagementSection v-else-if="view === 'configuration'" :title="`${integration.name}配置`">
            <ManagementField label="服务端点" type="url" />
            <ManagementField label="凭据" placeholder="凭据状态未加载" />
            <ManagementField v-if="integration.id === 'storage'" label="存储桶" />
            <ManagementField v-if="integration.id === 'storage'" label="区域" />
            <ManagementField v-if="integration.id === 'webhook'" label="订阅事件" placeholder="订阅状态未加载" />
            <div class="flex justify-end"><Button disabled>保存配置</Button></div>
        </ManagementSection>
        <ManagementSection v-else-if="view === 'event'" title="事件类型">
            <ManagementEmpty text="事件类型尚未加载" />
        </ManagementSection>
        <DataTable v-else :data="rows" :columns="columns" search-label="搜索同步事件" empty-text="同步记录尚未加载" />
    </section>
</template>
