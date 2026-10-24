<script setup lang="ts">
import type { NotificationPolicySnapshot } from '@/module/notification';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/ui/table';
import ChannelRule from './ChannelRule.vue';

defineProps<{ policy: NotificationPolicySnapshot }>();
</script>

<template>
    <div class="min-w-0 overflow-hidden rounded-md border bg-card">
        <Table class="min-w-[720px] table-fixed">
            <TableHeader>
                <TableRow>
                    <TableHead class="w-[18%]">严重级别</TableHead>
                    <TableHead class="w-[30%]">说明</TableHead>
                    <TableHead class="w-[26%]">发送频率</TableHead>
                    <TableHead class="w-[26%]">通知渠道</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow v-for="rule in policy.delivery" :key="rule.id">
                    <TableCell class="whitespace-normal break-words align-top py-4 font-medium">
                        {{ rule.severity.label }}
                    </TableCell>
                    <TableCell class="whitespace-normal break-words align-top py-4 text-muted-foreground">
                        {{ rule.severity.description ?? '未提供' }}
                    </TableCell>
                    <TableCell class="whitespace-normal break-words align-top py-4">
                        <template v-if="rule.timing.mode === 'immediate'">立即发送</template>
                        <template v-else-if="rule.timing.mode === 'daily'">
                            <p>每日汇总 · {{ rule.timing.time }}</p>
                            <p class="mt-1 text-xs text-muted-foreground">{{ rule.timing.timeZone }}</p>
                        </template>
                        <span v-else class="text-muted-foreground">发送频率未定义</span>
                    </TableCell>
                    <TableCell class="whitespace-normal break-words align-top py-4">
                        <ChannelRule :channels="policy.channels" :rules="rule.channels" />
                    </TableCell>
                </TableRow>
                <TableRow v-if="!policy.delivery.length">
                    <TableCell :colspan="4" class="h-24 text-center text-muted-foreground">
                        未提供严重级别投递规则
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    </div>
</template>
