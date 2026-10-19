<script setup lang="ts">
import { computed } from 'vue';
import { TriangleAlert, ListTodo, CircleHelp } from '@lucide/vue';
import { notificationEvent, notificationEvents, type NotificationPolicySnapshot } from '@/module/notification';
import { StateBadge } from '@/component/state-badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/ui/table';
import ChannelRule from './ChannelRule.vue';

const props = defineProps<{ policy: NotificationPolicySnapshot }>();
const groups = computed(() => {
    const events = props.policy.events.map((rule) => ({ rule, metadata: notificationEvent(rule.code) }));
    return [...new Set(notificationEvents.map((event) => event.group)), '未识别事件']
        .map((label) => ({
            label,
            events: events.filter((event) => (event.metadata?.group ?? '未识别事件') === label),
        }))
        .filter((group) => group.events.length);
});
</script>

<template>
    <div class="min-w-0 overflow-hidden rounded-md border bg-card">
        <Table class="min-w-[960px] table-fixed">
            <TableHeader>
                <TableRow>
                    <TableHead class="w-[18%]">事件类型</TableHead>
                    <TableHead class="w-[22%]">事件说明</TableHead>
                    <TableHead class="w-[24%]">接收对象与范围</TableHead>
                    <TableHead class="w-[23%]">通知渠道</TableHead>
                    <TableHead class="w-[13%]">启用与约束</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <template v-for="group in groups" :key="group.label">
                    <TableRow class="bg-muted/50 hover:bg-muted/50">
                        <TableCell :colspan="5" class="font-medium">{{ group.label }}</TableCell>
                    </TableRow>
                    <TableRow v-for="{ rule: event, metadata } in group.events" :key="event.code">
                        <TableCell class="whitespace-normal break-words align-top py-4">
                            <div class="flex items-start gap-2 font-medium">
                                <component
                                    :is="!metadata ? CircleHelp : event.code === 'ALERT' ? TriangleAlert : ListTodo"
                                    class="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <span class="min-w-0">{{ metadata?.label ?? event.code }}</span>
                            </div>
                        </TableCell>
                        <TableCell class="whitespace-normal break-words align-top py-4 text-muted-foreground">
                            {{ metadata?.description ?? '当前版本未识别此事件，仅展示来源规则。' }}
                        </TableCell>
                        <TableCell class="whitespace-normal break-words align-top py-4">
                            <ul v-if="event.recipients.length" class="space-y-3">
                                <li v-for="recipient in event.recipients" :key="recipient.id" class="space-y-1">
                                    <p>{{ recipient.label }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ recipient.scope ?? '接收范围未提供' }}
                                    </p>
                                    <StateBadge v-if="recipient.status !== 'active'" tone="warning">
                                        {{ recipient.status === 'archived' ? '接收对象已归档' : '接收对象状态未知' }}
                                    </StateBadge>
                                </li>
                            </ul>
                            <span v-else class="text-muted-foreground">未提供接收对象</span>
                        </TableCell>
                        <TableCell class="whitespace-normal break-words align-top py-4">
                            <ChannelRule :channels="policy.channels" :rules="event.channels" />
                        </TableCell>
                        <TableCell class="whitespace-normal align-top py-4">
                            <div class="space-y-2">
                                <StateBadge :tone="event.enabled === true ? 'success' : 'neutral'">
                                    {{ event.enabled === null ? '状态未知' : event.enabled ? '已启用' : '已停用' }}
                                </StateBadge>
                                <p class="text-xs text-muted-foreground">
                                    {{
                                        event.requirement === 'required'
                                            ? '组织强制'
                                            : event.requirement === 'optional'
                                              ? '个人可选'
                                              : '约束未定义'
                                    }}
                                </p>
                            </div>
                        </TableCell>
                    </TableRow>
                </template>
                <TableRow v-if="!groups.length">
                    <TableCell :colspan="5" class="h-32 text-center text-muted-foreground">
                        此组织尚无可展示的事件规则
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    </div>
</template>
