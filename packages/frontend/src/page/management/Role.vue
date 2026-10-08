<script setup lang="ts">
import { ShieldCheck, Folders, KeyRound, UsersRound, Calendar, Plus } from '@lucide/vue';
import { DataTable } from '@/component/data-table';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/ui/table';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementField from './component/ManagementField.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import { column, type ManagementRow } from './table';
import { useManagementView } from './useManagementView';

const views = [
    { value: 'list', label: '角色列表' },
    { value: 'matrix', label: '权限矩阵' },
];
const view = useManagementView(views);
const actions = ['查看', '创建', '修改', '领用', '操作'];
const resources = [
    { label: '材料', actions: ['查看', '创建', '修改'] },
    { label: '库存', actions: ['查看', '创建', '修改', '领用'] },
    { label: '设备', actions: ['查看', '创建', '修改', '操作'] },
    { label: '文件', actions: ['查看', '创建', '修改'] },
];

const rows: ManagementRow[] = [];
const columns = [
    column('name', '角色名称', 240, ShieldCheck),
    column('scope', '作用域', 200, Folders),
    column('grants', '授予权限', 320, KeyRound),
    column('members', '成员数', 130, UsersRound),
    column('updatedAt', '最近更新', 200, Calendar),
];
</script>

<template>
    <ManagementPage title="角色与权限" :layout="view === 'list' ? 'table' : 'form'">
        <template #actions>
            <Button disabled>
                <Plus aria-hidden="true" />
                新建角色
            </Button>
        </template>
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="角色与权限视图" /></template>
        <DataTable
            v-if="view === 'list'"
            :data="rows"
            :columns="columns"
            search-label="搜索角色"
            empty-text="角色数据尚未加载"
        />
        <ManagementSection v-else title="权限矩阵">
            <div class="grid grid-cols-2 gap-4">
                <ManagementField label="角色" placeholder="未选择角色" />
                <ManagementField label="作用域" placeholder="未选择角色" />
            </div>
            <div class="overflow-hidden rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>资源类型</TableHead>
                            <TableHead v-for="action in actions" :key="action" class="text-center">
                                {{ action }}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="resource in resources" :key="resource.label">
                            <TableCell class="font-medium">{{ resource.label }}</TableCell>
                            <TableCell v-for="action in actions" :key="action" class="text-center">
                                <Checkbox
                                    v-if="resource.actions.includes(action)"
                                    disabled
                                    class="mx-auto"
                                    :aria-label="`${resource.label}${action}授权状态未加载`"
                                />
                                <span v-else class="text-muted-foreground">—</span>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
            <div class="flex justify-end gap-2">
                <Button variant="outline" disabled>取消</Button>
                <Button disabled>保存更改</Button>
            </div>
        </ManagementSection>
    </ManagementPage>
</template>
