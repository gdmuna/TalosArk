<script setup lang="ts">
import { Button } from '@/ui/button';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementField from './component/ManagementField.vue';
</script>

<template>
    <ManagementPage title="系统设置" layout="form">
        <div class="max-w-3xl space-y-8">
            <ManagementSection title="数据治理">
                <div class="grid grid-cols-2 gap-4">
                    <ManagementField label="归档保留期限（天）" type="number" />
                    <ManagementField label="审计导出权限" :options="['组织管理员', '指定角色']" />
                </div>
            </ManagementSection>
            <ManagementSection title="默认规则">
                <div class="grid grid-cols-2 gap-4">
                    <ManagementField label="邀请有效期（天）" type="number" />
                    <ManagementField label="默认时区" :options="['Asia/Shanghai', 'Asia/Taipei', 'UTC']" />
                </div>
            </ManagementSection>
            <ManagementSection title="订阅与版本">
                <dl class="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 gap-y-4">
                    <dt class="text-muted-foreground">当前套餐</dt>
                    <dd>—</dd>
                    <dt class="text-muted-foreground">套餐版本</dt>
                    <dd>—</dd>
                    <dt class="text-muted-foreground">生效时间</dt>
                    <dd>—</dd>
                </dl>
            </ManagementSection>
            <div class="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" disabled>取消</Button>
                <Button disabled>保存更改</Button>
            </div>
        </div>
    </ManagementPage>
</template>
