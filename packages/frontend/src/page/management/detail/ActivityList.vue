<script setup lang="ts">
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/ui/table';
import { detailDate, type DetailActivity } from './prototype';
defineProps<{ items: DetailActivity[] }>();
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
                        当前组织范围内没有相关活动
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    </div>
</template>
