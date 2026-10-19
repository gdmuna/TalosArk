<script setup lang="ts">
import { computed } from 'vue';
import type { OrganizationPolicy } from '@/module/organization';
import { StateBadge } from '@/component/state-badge';
import { formatDateTime } from '@/shared/util/date-time';

const props = defineProps<{ policy: OrganizationPolicy }>();
const origin = { organization: '组织规则', 'deployment-default': '继承部署默认值', unknown: '来源未提供' };
const rows = computed(() => [
    {
        label: '归档保留周期',
        fact: props.policy.archiveRetention,
        value: props.policy.archiveRetention.days === null ? '未定义' : `${props.policy.archiveRetention.days} 天`,
    },
    {
        label: '审计导出范围',
        fact: props.policy.auditExport,
        value:
            props.policy.auditExport.mode === 'administrator'
                ? '组织管理员'
                : props.policy.auditExport.mode === 'roles'
                  ? props.policy.auditExport.roleNames.join('、') || '角色信息未提供'
                  : props.policy.auditExport.mode === 'unavailable'
                    ? '未开放'
                    : '未定义',
    },
    {
        label: '邀请有效期',
        fact: props.policy.invitationValidity,
        value: props.policy.invitationValidity.days === null ? '未定义' : `${props.policy.invitationValidity.days} 天`,
    },
    { label: '默认时区', fact: props.policy.timeZone, value: props.policy.timeZone.value ?? '未定义' },
]);
</script>

<template>
    <div class="space-y-5">
        <dl class="divide-y">
            <div
                v-for="row in rows"
                :key="row.label"
                class="grid min-w-0 gap-3 py-5 first:pt-0 @xl:grid-cols-[140px_minmax(0,1fr)]"
            >
                <dt class="text-sm font-medium">{{ row.label }}</dt>
                <dd class="min-w-0 space-y-2 text-sm">
                    <p class="break-words font-medium">{{ row.value }}</p>
                    <StateBadge>{{ origin[row.fact.origin] }}</StateBadge>
                    <p class="break-words text-xs text-muted-foreground">
                        {{ row.fact.impact ?? '作用范围与影响未提供' }}
                    </p>
                </dd>
            </div>
        </dl>
        <p class="border-t pt-4 text-xs text-muted-foreground">
            读取于 {{ formatDateTime(Date.parse(policy.measuredAt)) }} · 最近更新
            {{ policy.updatedAt ? formatDateTime(Date.parse(policy.updatedAt)) : '未提供' }}
        </p>
    </div>
</template>
