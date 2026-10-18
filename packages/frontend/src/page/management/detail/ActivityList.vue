<script setup lang="ts">
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/ui/table';
import type { ManagementActivityPage } from '@talos-ark/contracts/team';
import { Button } from '@/ui/button';
import { detailDate } from './read';
defineProps<{ items: ManagementActivityPage['items']; loading?: boolean; error?: string; hasMore?: boolean }>();
const emit = defineEmits<{ more: []; retry: [] }>();
</script>
<template>
    <div class="overflow-x-auto rounded-md border">
        <Table class="min-w-[640px]" container-class="overflow-visible" aria-label="当前组织内的活动">
            <TableHeader>
                <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>操作者</TableHead>
                    <TableHead>动作</TableHead>
                    <TableHead>对象</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow v-for="item in items" :key="item.id">
                    <TableCell>{{ detailDate(item.occurredAt) }}</TableCell>
                    <TableCell>{{ item.actorName }}</TableCell>
                    <TableCell>{{ item.action }}</TableCell>
                    <TableCell class="whitespace-normal">{{ item.subjectName }}</TableCell>
                </TableRow>
                <TableRow v-if="!items.length">
                    <TableCell colspan="4" class="h-28 text-center text-muted-foreground">
                        {{ loading ? '正在加载活动' : error ? '活动暂不可用' : '当前授权范围内没有相关管理活动' }}
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
        <div v-if="error || hasMore" class="flex items-center gap-3 border-t p-3 text-sm">
            <span v-if="error" role="alert" class="text-destructive">{{ error }}</span>
            <Button v-if="error" variant="outline" size="sm" :disabled="loading" @click="emit('retry')">
                重试读取
            </Button>
            <Button v-else-if="hasMore" variant="ghost" size="sm" :disabled="loading" @click="emit('more')">
                {{ loading ? '加载中' : '加载更多' }}
            </Button>
        </div>
    </div>
</template>
