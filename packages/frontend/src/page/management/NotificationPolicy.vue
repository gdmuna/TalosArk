<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bell, RotateCw, Info, ArrowUpRight } from '@lucide/vue';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import { useNotificationPolicy } from '@/module/notification';
import { SelectField } from '@/component/select-field';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/ui/empty';
import { formatDateTime } from '@/shared/util/date-time';
import { managementPath } from '@/router/management-navigation';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import PersonalNotificationSetting from './component/PersonalNotificationSetting.vue';
import EventMatrix from './notification/EventMatrix.vue';
import DeliveryMatrix from './notification/DeliveryMatrix.vue';
import { useManagementView } from './useManagementView';

const route = useRoute();
const router = useRouter();
const account = useAccountStore();
const workspace = useWorkspaceStore();
const views = [
    { value: 'policy', label: '通知策略' },
    { value: 'personal', label: '个人通知设置' },
];
const view = useManagementView(views);
const path = `${managementPath}/notification-policy`;
const organizationId = computed({
    get: () =>
        route.query.organization === undefined
            ? (workspace.organization?.id ?? workspace.organizations[0]?.id ?? '')
            : typeof route.query.organization === 'string'
              ? route.query.organization
              : '',
    set: (value: string) => {
        if (route.path !== path || !workspace.organizations.some((item) => item.id === value)) return;
        void router.replace({ path, query: { ...route.query, organization: value }, hash: route.hash });
    },
});
const organization = computed(() =>
    account.profile ? workspace.organizations.find((item) => item.id === organizationId.value) : undefined
);
const options = computed(() =>
    account.profile ? workspace.organizations.map((item) => ({ value: item.id, label: item.name })) : []
);
const context = computed(() =>
    account.profile && organization.value && route.path === path && view.value === 'policy'
        ? { accountId: account.profile.id, organizationId: organization.value.id }
        : null
);
const { available, data, loading, error, refresh } = useNotificationPolicy(context);
</script>

<template>
    <ManagementPage
        title="通知策略"
        :layout="view === 'personal' ? 'form' : 'wide'"
        :context="
            view === 'personal' ? (account.profile?.displayName ?? '当前账户') : (organization?.name ?? '组织不可用')
        "
    >
        <template #navigation><ManagementViewNav v-model="view" :items="views" label="通知策略视图" /></template>
        <template v-if="view === 'policy'" #actions>
            <div class="w-60 max-w-full [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-value]]:min-w-0">
                <SelectField v-model="organizationId" :options="options" label="当前管理组织" />
            </div>
            <Button v-if="available" variant="outline" :disabled="loading || !context" @click="refresh">
                <RotateCw aria-hidden="true" />
                刷新
            </Button>
        </template>
        <PersonalNotificationSetting v-if="view === 'personal'" />
        <p v-else-if="!organization" role="alert" class="text-sm text-destructive">组织不存在或不在当前可访问范围内</p>
        <Empty v-else-if="!available" class="min-h-72 border-0">
            <EmptyHeader>
                <EmptyMedia variant="icon"><Bell aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>组织通知策略暂不可用</EmptyTitle>
                <EmptyDescription>通知策略服务尚未开放，现有业务通知不受此页面影响。</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" as-child>
                <RouterLink :to="{ path: `${managementPath}/account-setting`, query: { view: 'notification' } }">
                    <ArrowUpRight aria-hidden="true" />
                    个人通知设置
                </RouterLink>
            </Button>
        </Empty>
        <template v-else>
            <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取通知策略</p>
            <div v-if="error" role="alert" class="flex flex-wrap items-center gap-2 text-sm text-destructive">
                <span>{{ error }}{{ data ? '，当前显示上次读取结果，可能已过期。' : '' }}</span>
                <Button variant="outline" size="sm" :disabled="loading" @click="refresh">重新加载</Button>
            </div>
            <template v-if="data">
                <div class="flex flex-wrap items-start justify-between gap-3 text-sm">
                    <div class="min-w-0 space-y-1">
                        <p class="break-words">{{ data.scopeLabel }}</p>
                        <p class="break-words text-xs text-muted-foreground">
                            读取于 {{ formatDateTime(Date.parse(data.measuredAt)) }} · 最近更新
                            {{ data.updatedAt ? formatDateTime(Date.parse(data.updatedAt)) : '未提供' }} ·
                            {{ data.updatedBy ?? '更新人未提供' }}
                        </p>
                    </div>
                    <StateBadge>只读</StateBadge>
                </div>
                <ManagementSection title="组织通知规则"><EventMatrix :policy="data" /></ManagementSection>
                <ManagementSection title="通知频率与严重级别规则"><DeliveryMatrix :policy="data" /></ManagementSection>
                <ManagementSection title="渠道能力">
                    <dl class="grid min-w-0 gap-x-8 gap-y-4 @lg:grid-cols-2">
                        <div v-for="channel in data.channels" :key="channel.id" class="min-w-0 space-y-2 border-b pb-4">
                            <dt class="flex flex-wrap items-center gap-2 font-medium">
                                {{ channel.label }}
                                <StateBadge :tone="channel.availability === 'available' ? 'success' : 'neutral'">
                                    {{
                                        channel.availability === 'available'
                                            ? '可用'
                                            : channel.availability === 'unavailable'
                                              ? '不可用'
                                              : '状态未知'
                                    }}
                                </StateBadge>
                            </dt>
                            <dd class="break-words text-sm text-muted-foreground">
                                {{
                                    channel.reason ??
                                    (channel.availability === 'available' ? '未提供补充说明' : '未提供原因')
                                }}
                            </dd>
                        </div>
                    </dl>
                    <p v-if="!data.channels.length" class="text-sm text-muted-foreground">未提供渠道能力</p>
                    <p class="text-xs text-muted-foreground">渠道可用与规则启用不代表消息已经发送或送达。</p>
                </ManagementSection>
                <div class="flex items-start gap-3 border-t pt-4 text-sm text-muted-foreground">
                    <Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <p>
                        组织强制规则不能由个人偏好覆盖；仅来源明确标记为个人可选的规则可受个人偏好影响。
                        <Button variant="link" class="h-auto whitespace-normal p-0" @click="view = 'personal'">
                            个人通知设置
                        </Button>
                    </p>
                </div>
            </template>
        </template>
    </ManagementPage>
</template>
