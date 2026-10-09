<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Monitor, Terminal, Pencil, Plus, Wrench } from '@lucide/vue';
import { Button } from '@/ui/button';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import { useResourceBreadcrumb } from '../../resource/useResourceBreadcrumb';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceViewNav from '../../resource/ResourceViewNav.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceFactList from '../../resource/ResourceFactList.vue';
import ResourceTable from '../../resource/ResourceTable.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';
import { useResource } from '../../resource/useResource';
import { useResourceView } from '../../resource/useResourceView';
const { resource, resourceId, workspace } = useResource('设备');
const router = useRouter();
const { returnTo } = useResourceBreadcrumb({
    domain: 'equipment',
    kind: '设备',
    listLabel: '设备列表',
    resource,
    resourceId,
});
const tabs = [
    { id: 'runtime', label: '运行状态' },
    { id: 'information', label: '设备信息' },
    { id: 'binding', label: '绑定' },
    { id: 'maintenance', label: '维护记录' },
    { id: 'command', label: '指令历史' },
];
const { view, select } = useResourceView(tabs.map((tab) => tab.id));
function openConsole() {
    return router.push(`/main/equipment/detail/${encodeURIComponent(resourceId.value)}/console`);
}
</script>
<template>
    <ResourceDetailPage label="设备详情">
        <template #header>
            <ResourceObjectHeader
                :id="resourceId"
                :title="resource?.name ?? '设备详情'"
                :icon="Monitor"
                :status="resource?.status"
                :back-to="returnTo"
                back-label="设备列表"
            >
                <Button variant="outline" disabled>
                    <Pencil aria-hidden="true" />
                    编辑信息
                </Button>
                <Button :disabled="!resource" @click="openConsole">
                    <Terminal aria-hidden="true" />
                    操作台
                </Button>
            </ResourceObjectHeader>
            <ResourceViewNav v-if="resource" :items="tabs" :active="view" label="设备详情视图" @select="select" />
        </template>
        <ResourceEmpty v-if="!resource" text="当前工作区未找到该设备" />
        <template v-else>
            <template v-if="view === 'runtime'">
                <ResourceSection title="当前状态">
                    <ResourceFactList
                        :fields="[
                            { label: '连接状态' },
                            { label: '运行状态' },
                            { label: '最近上报' },
                            { label: '固件版本' },
                        ]"
                    />
                </ResourceSection>
                <div class="grid gap-8 @3xl:grid-cols-2">
                    <ResourceSection title="实时监测">
                        <ResourceTable
                            :fields="[
                                ['metric', '指标', 180],
                                ['value', '当前值', 120],
                                ['unit', '单位', 100],
                                ['time', '采集时间', 180],
                            ]"
                        />
                    </ResourceSection>
                    <ResourceSection title="历史趋势">
                        <div class="flex min-h-64 items-center justify-center rounded-md border bg-muted/20">
                            <ResourceEmpty text="遥测时间序列未加载" />
                        </div>
                    </ResourceSection>
                </div>
                <ResourceSection title="近期告警">
                    <ResourceTable
                        :fields="[
                            ['event', '告警事件', 280],
                            ['severity', '等级', 100],
                            ['time', '发生时间', 180],
                            ['status', '处理状态', 130],
                        ]"
                    />
                </ResourceSection>
            </template>
            <template v-else-if="view === 'information'">
                <ResourceSection title="设备档案">
                    <ResourceFactList
                        :fields="[
                            { label: '设备名称', value: resource.name },
                            { label: '设备类型' },
                            { label: '型号' },
                            { label: '序列号' },
                            { label: '所属组织' },
                            { label: '当前工作区', value: workspace.current?.name },
                            { label: '安装位置' },
                            { label: '负责人' },
                            { label: '安装日期' },
                            { label: '说明', value: resource.description },
                        ]"
                    />
                </ResourceSection>
                <ResourceSection title="连接与能力">
                    <ResourceFactList
                        :fields="[
                            { label: '连接协议' },
                            { label: '固件版本' },
                            { label: '遥测能力' },
                            { label: '可用指令' },
                        ]"
                    />
                </ResourceSection>
            </template>
            <template v-else-if="view === 'binding'">
                <ResourceSection title="归属与管理">
                    <ResourceFactList
                        :fields="[{ label: '归属组织' }, { label: '管理工作区' }, { label: '管理权限' }]"
                    />
                </ResourceSection>
                <ResourceSection title="共享与绑定">
                    <template #actions>
                        <Button disabled>
                            <Plus aria-hidden="true" />
                            添加绑定
                        </Button>
                    </template>
                    <ResourceTable
                        :fields="[
                            ['workspace', '工作区', 260],
                            ['relation', '关系', 140],
                            ['permission', '权限', 160],
                            ['created', '绑定时间', 180],
                        ]"
                    />
                </ResourceSection>
            </template>
            <template v-else-if="view === 'maintenance'">
                <ResourceSection title="维护计划">
                    <ResourceFactList
                        :fields="[
                            { label: '下次维护' },
                            { label: '维护周期' },
                            { label: '负责人' },
                            { label: '计划状态' },
                        ]"
                    />
                </ResourceSection>
                <ResourceSection title="维护记录">
                    <template #actions>
                        <Button disabled>
                            <Wrench aria-hidden="true" />
                            记录维护
                        </Button>
                    </template>
                    <ResourceTable
                        :fields="[
                            ['date', '日期', 160],
                            ['type', '类型', 120],
                            ['summary', '摘要', 260],
                            ['operator', '操作人', 120],
                            ['attachment', '附件', 120],
                            ['status', '状态', 120],
                        ]"
                    />
                </ResourceSection>
            </template>
            <template v-else>
                <ResourceSection title="指令历史">
                    <ResourceTable
                        :fields="[
                            ['id', '指令 ID', 200],
                            ['type', '指令类型', 160],
                            ['initiator', '发起人', 120],
                            ['time', '发起时间', 180],
                            ['result', '执行结果', 140],
                        ]"
                    />
                </ResourceSection>
                <ResourceSection title="执行回执"><ResourceEmpty text="选择指令记录" /></ResourceSection>
            </template>
        </template>
    </ResourceDetailPage>
</template>
