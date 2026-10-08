<script setup lang="ts">
import { FlaskConical, Monitor, FileText } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/ui/table';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementField from './component/ManagementField.vue';

const categories = [
    { name: '材料', icon: FlaskConical },
    { name: '设备', icon: Monitor },
    { name: '文件', icon: FileText },
];
</script>

<template>
    <ManagementPage title="共享策略" layout="form">
        <ManagementSection title="组织内资源共享">
            <div class="overflow-x-auto rounded-lg border bg-card">
                <Table class="min-w-180">
                    <TableHeader>
                        <TableRow>
                            <TableHead>资源类型</TableHead>
                            <TableHead>共享范围</TableHead>
                            <TableHead>授权方式</TableHead>
                            <TableHead>审批要求</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="category in categories" :key="category.name">
                            <TableCell>
                                <span class="flex items-center gap-2">
                                    <component :is="category.icon" class="size-4" aria-hidden="true" />
                                    {{ category.name }}
                                </span>
                            </TableCell>
                            <TableCell>组织内部</TableCell>
                            <TableCell>
                                <ManagementField
                                    hide-label
                                    :label="`${category.name}授权方式`"
                                    :options="['管理员授权', '申请后授权']"
                                />
                            </TableCell>
                            <TableCell>
                                <ManagementField
                                    hide-label
                                    :label="`${category.name}审批要求`"
                                    :options="['需要审批', '无需审批']"
                                />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </ManagementSection>
        <ManagementSection title="授权默认值">
            <div class="grid max-w-3xl grid-cols-2 gap-4">
                <ManagementField label="默认授权有效期（天）" type="number" />
                <ManagementField label="到期提醒提前量（天）" type="number" />
            </div>
        </ManagementSection>
        <div class="flex max-w-3xl justify-end gap-2 border-t pt-4">
            <Button variant="outline" disabled>取消</Button>
            <Button disabled>保存策略</Button>
        </div>
    </ManagementPage>
</template>
