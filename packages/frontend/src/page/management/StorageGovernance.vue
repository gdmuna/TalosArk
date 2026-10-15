<script setup lang="ts">
import { Plus, Search, Pencil } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { DataTable } from '@/component/data-table';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementField from './component/ManagementField.vue';
import ManagementEmpty from './component/ManagementEmpty.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import { useManagementView } from './useManagementView';
import { column, type ManagementRow } from './table';

const views = [
    { value: 'structure', label: '设施结构' },
    { value: 'rule', label: '治理规则' },
    { value: 'template', label: '模板管理' },
];
const view = useManagementView(views);
const templates: ManagementRow[] = [];
const templateColumns = [
    column('name', '模板名称', 260),
    column('version', '版本', 130),
    column('nodeTypes', '适用节点类型', 260),
    column('state', '状态', 140),
    column('updatedAt', '最近更新', 200),
];
</script>

<template>
    <ManagementPage title="存储设施治理" :layout="view === 'rule' ? 'form' : view === 'template' ? 'table' : 'tool'">
        <template #actions>
            <Button variant="outline" disabled>
                <Pencil aria-hidden="true" />
                编辑规则
            </Button>
            <Button disabled>
                <Plus aria-hidden="true" />
                新增节点
            </Button>
        </template>
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="存储设施治理视图" /></template>
        <div v-if="view === 'structure'" class="grid gap-6 @5xl:grid-cols-[220px_minmax(0,1fr)_220px]">
            <ManagementSection title="设施结构">
                <div class="relative">
                    <Search
                        class="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Input class="bg-card pl-9" placeholder="搜索设施或节点" aria-label="搜索设施或节点" disabled />
                </div>
                <ManagementEmpty text="设施结构尚未加载" />
            </ManagementSection>
            <ManagementSection title="节点规则">
                <p class="text-muted-foreground">未选择节点</p>
                <div class="grid grid-cols-2 gap-4">
                    <ManagementField label="节点名称" placeholder="未选择节点" />
                    <ManagementField label="节点编码" placeholder="未选择节点" />
                    <ManagementField label="节点类型" :options="['存储设施', '存储分区', '存储容器', '存储位置']" />
                    <ManagementField label="容量" type="number" placeholder="未选择节点" />
                    <ManagementField label="允许的子节点类型" placeholder="未选择节点" />
                    <ManagementField label="规则继承" :options="['继承父节点', '独立规则']" />
                    <ManagementField label="模板版本" placeholder="未选择节点" />
                    <ManagementField label="管理工作区" placeholder="未选择节点" />
                </div>
            </ManagementSection>
            <ManagementSection title="层级预览"><ManagementEmpty text="未选择节点" /></ManagementSection>
        </div>
        <ManagementSection v-else-if="view === 'rule'" title="治理规则">
            <ManagementField label="适用设施或节点" placeholder="未选择节点" />
            <div class="grid grid-cols-2 gap-4">
                <ManagementField label="允许的子节点类型" />
                <ManagementField label="容量上限" type="number" />
                <ManagementField label="编码规则" />
                <ManagementField label="权限继承" :options="['继承父节点', '独立规则']" />
            </div>
            <div class="flex justify-end gap-2">
                <Button variant="outline" disabled>取消</Button>
                <Button disabled>保存规则</Button>
            </div>
        </ManagementSection>
        <DataTable
            v-else
            :data="templates"
            :columns="templateColumns"
            search-label="搜索模板名称或节点类型"
            empty-text="治理模板尚未加载"
        />
    </ManagementPage>
</template>
