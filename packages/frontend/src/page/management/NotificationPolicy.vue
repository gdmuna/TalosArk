<script setup lang="ts">
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { useAccountStore } from '@/module/account';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/ui/table';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementField from './component/ManagementField.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import PersonalNotificationSetting from './component/PersonalNotificationSetting.vue';
import { useManagementView } from './useManagementView';

const views = [
    { value: 'policy', label: '通知策略' },
    { value: 'personal', label: '个人通知设置' },
];
const view = useManagementView(views);
const account = useAccountStore();

const events = ['审批待处理', '授权即将到期', '库存异常', '设备异常', '存储设施变更'];
</script>

<template>
    <ManagementPage
        title="通知策略"
        :layout="view === 'personal' ? 'form' : 'wide'"
        :context="view === 'personal' ? (account.profile?.displayName ?? '当前账户') : undefined"
    >
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="通知策略视图" /></template>
        <template v-if="view === 'policy'">
            <ManagementSection title="组织通知规则">
                <div class="overflow-x-auto rounded-lg border bg-card">
                    <Table class="min-w-200">
                        <TableHeader>
                            <TableRow>
                                <TableHead>事件</TableHead>
                                <TableHead>接收对象</TableHead>
                                <TableHead>通知渠道</TableHead>
                                <TableHead>启用状态</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-for="event in events" :key="event">
                                <TableCell class="font-medium">{{ event }}</TableCell>
                                <TableCell>
                                    <ManagementField
                                        hide-label
                                        :label="`${event}接收对象`"
                                        :options="['组织管理员', '工作区管理员', '资源负责人']"
                                    />
                                </TableCell>
                                <TableCell>
                                    <ManagementField
                                        hide-label
                                        :label="`${event}通知渠道`"
                                        placeholder="渠道状态未加载"
                                    />
                                </TableCell>
                                <TableCell>
                                    <span class="flex items-center gap-2 text-muted-foreground">
                                        <Checkbox disabled :aria-label="`${event}启用状态未加载`" />
                                        未加载
                                    </span>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </ManagementSection>
            <ManagementSection title="异常分级投递" class="mx-auto max-w-3xl">
                <div class="grid max-w-3xl grid-cols-2 gap-4">
                    <ManagementField label="严重异常" :options="['即时投递']" />
                    <ManagementField label="一般异常与提醒" :options="['即时投递', '每日汇总']" />
                </div>
            </ManagementSection>
            <div class="mx-auto flex max-w-3xl justify-end gap-2 border-t pt-4">
                <Button variant="outline" disabled>取消</Button>
                <Button disabled>保存策略</Button>
            </div>
        </template>
        <PersonalNotificationSetting v-else />
    </ManagementPage>
</template>
