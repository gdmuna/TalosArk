<script setup lang="ts">
import { Bell } from '@lucide/vue';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/ui/empty';
</script>

<template>
    <Empty class="min-h-64 border-0">
        <EmptyHeader>
            <EmptyMedia variant="icon"><Bell aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>个人通知偏好暂不可用</EmptyTitle>
            <EmptyDescription>个人接收偏好服务尚未开放，此处不会更改组织通知规则。</EmptyDescription>
        </EmptyHeader>
    </Empty>
</template>
