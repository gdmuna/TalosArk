<script setup lang="ts">
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import ManagementSection from './ManagementSection.vue';
import ManagementField from './ManagementField.vue';
</script>

<template>
    <div class="space-y-6">
        <ManagementSection title="个人接收偏好">
            <div class="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <div
                    v-for="channel in ['站内通知', '邮件通知']"
                    :key="channel"
                    class="flex items-center justify-between gap-4 border-b pb-4"
                >
                    <span>{{ channel }}</span>
                    <span class="flex items-center gap-2 text-muted-foreground">
                        <Checkbox disabled :aria-label="`${channel}接收偏好未加载`" />
                        未加载
                    </span>
                </div>
                <ManagementField label="投递频率" :options="['即时接收', '每日汇总']" />
                <ManagementField label="免打扰时段" />
            </div>
        </ManagementSection>
        <div class="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" disabled>取消</Button>
            <Button disabled>保存偏好</Button>
        </div>
    </div>
</template>
