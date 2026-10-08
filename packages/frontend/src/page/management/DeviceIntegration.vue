<script setup lang="ts">
import { Monitor, Hash, RefreshCw, Activity, Calendar, PlugZap } from '@lucide/vue';
import { DataTable } from '@/component/data-table';
import { Button } from '@/ui/button';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementField from './component/ManagementField.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import { column, type ManagementRow } from './table';
import { useManagementView } from './useManagementView';

const views = [
    { value: 'basic', label: '基本信息' },
    { value: 'mapping', label: '设备映射' },
    { value: 'log', label: '连接日志' },
    { value: 'status', label: '运行状态' },
];
const view = useManagementView(views);
const logs: ManagementRow[] = [];
const logColumns = [
    column('occurredAt', '时间', 220, Calendar),
    column('backend', '控制后端', 220),
    column('event', '连接事件', 280),
    column('result', '结果', 140),
];

const rows: ManagementRow[] = [];
const columns = [
    column('device', '设备', 240, Monitor),
    column('externalId', '外部设备标识', 240, Hash),
    column('syncState', '同步状态', 180, RefreshCw),
    column('health', '连接健康', 160, Activity),
    column('checkedAt', '最近检查', 220, Calendar),
];
</script>

<template>
    <ManagementPage
        title="设备集成"
        :layout="view === 'mapping' || view === 'log' ? 'table' : view === 'status' ? 'form' : 'wide'"
    >
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="设备集成视图" /></template>
        <div v-if="view === 'basic'" class="grid gap-6 @4xl:grid-cols-2">
            <ManagementSection title="连接配置">
                <ManagementField label="控制后端" placeholder="未选择控制后端" />
                <ManagementField label="服务端点" type="url" />
                <ManagementField label="凭据" placeholder="凭据状态未加载" />
                <ManagementField label="支持能力" placeholder="能力信息未加载" />
                <div class="flex justify-end gap-2">
                    <Button variant="outline" disabled>
                        <PlugZap aria-hidden="true" />
                        测试连接
                    </Button>
                    <Button disabled>保存配置</Button>
                </div>
            </ManagementSection>
            <ManagementSection title="连接状态">
                <dl class="grid grid-cols-[140px_minmax(0,1fr)] gap-4">
                    <dt class="text-muted-foreground">当前状态</dt>
                    <dd>未加载</dd>
                    <dt class="text-muted-foreground">最后心跳</dt>
                    <dd>—</dd>
                    <dt class="text-muted-foreground">最近健康检查</dt>
                    <dd>—</dd>
                    <dt class="text-muted-foreground">网关版本</dt>
                    <dd>—</dd>
                </dl>
            </ManagementSection>
        </div>
        <DataTable
            v-else-if="view === 'mapping'"
            :data="rows"
            :columns="columns"
            search-label="搜索设备或外部标识"
            empty-text="设备映射尚未加载"
        />
        <DataTable
            v-else-if="view === 'log'"
            :data="logs"
            :columns="logColumns"
            search-label="搜索控制后端或连接事件"
            empty-text="连接日志尚未加载"
        />
        <ManagementSection v-else title="运行状态">
            <dl class="grid grid-cols-[160px_minmax(0,1fr)] gap-4">
                <dt class="text-muted-foreground">控制后端</dt>
                <dd>未选择</dd>
                <dt class="text-muted-foreground">连接健康</dt>
                <dd>未加载</dd>
                <dt class="text-muted-foreground">连续运行时间</dt>
                <dd>—</dd>
                <dt class="text-muted-foreground">遥测读取</dt>
                <dd>未加载</dd>
                <dt class="text-muted-foreground">命令执行</dt>
                <dd>未加载</dd>
            </dl>
        </ManagementSection>
    </ManagementPage>
</template>
