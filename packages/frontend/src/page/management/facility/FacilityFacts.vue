<script setup lang="ts">
import type { FacilityDetail } from '@/module/facility';
import { useWorkspaceStore } from '@/module/workspace';
import FactList from '../detail/FactList.vue';
import { facilityDate } from './context';
defineProps<{ data: FacilityDetail; organizationName?: string }>();
const workspace = useWorkspaceStore();
</script>
<template>
    <FactList
        :fields="[
            { label: '设施名称', value: data.name },
            { label: '设施编号', value: data.code ?? '未填写' },
            { label: '所属组织', value: organizationName ?? data.organizationId },
            { label: '位置', value: data.location },
            {
                label: '管理工作区',
                value:
                    workspace.workspaces.find((item) => item.id === data.managementWorkspaceId)?.name ??
                    data.managementWorkspaceId,
            },
            { label: '状态', value: data.archivedAt ? '已归档' : data.disabledAt ? '已停用' : '正常' },
            { label: '创建时间', value: facilityDate(data.createdAt) },
            { label: '最近更新', value: facilityDate(data.updatedAt) },
            { label: '说明', value: data.description },
        ]"
    />
</template>
