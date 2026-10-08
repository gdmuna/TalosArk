<script setup lang="ts">
import { Building2, Upload } from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { Button } from '@/ui/button';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementField from './component/ManagementField.vue';

const workspace = useWorkspaceStore();
</script>

<template>
    <ManagementPage title="组织设置" layout="form">
        <div class="max-w-3xl space-y-8">
            <ManagementSection title="基本信息">
                <div class="flex items-center gap-4">
                    <div class="flex size-16 items-center justify-center rounded-lg border bg-muted">
                        <Building2 class="size-7 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <Button variant="outline" disabled>
                        <Upload aria-hidden="true" />
                        上传组织标识
                    </Button>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <ManagementField label="组织名称" :value="workspace.organization?.name" />
                    <ManagementField label="组织标识" :value="workspace.organization?.id" />
                    <ManagementField label="联系邮箱" type="email" />
                    <ManagementField label="默认时区" :options="['Asia/Shanghai', 'Asia/Taipei', 'UTC']" />
                </div>
                <ManagementField label="组织描述" multiline />
            </ManagementSection>
            <ManagementSection title="成员加入规则">
                <div class="grid grid-cols-2 gap-4">
                    <ManagementField label="加入方式" :options="['仅限邀请', '申请后审批']" />
                    <ManagementField label="邀请权限" :options="['组织管理员', '组织管理员与工作区管理员']" />
                </div>
                <ManagementField label="允许加入的邮箱域名" />
            </ManagementSection>
            <div class="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" disabled>取消</Button>
                <Button disabled>保存更改</Button>
            </div>
            <ManagementSection title="组织生命周期">
                <div class="flex items-center justify-between gap-4">
                    <span class="text-muted-foreground">删除组织</span>
                    <Button variant="outline" disabled>删除组织</Button>
                </div>
            </ManagementSection>
        </div>
    </ManagementPage>
</template>
