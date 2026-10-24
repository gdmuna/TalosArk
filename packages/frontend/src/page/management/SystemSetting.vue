<script setup lang="ts">
import { Settings, Server, UserRound, ArrowUpRight } from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { useOrganizationPolicy } from '@/module/organization';
import { useDeploymentInformation } from '@/module/deployment';
import { SelectField } from '@/component/select-field';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/ui/empty';
import { formatDateTime } from '@/shared/util/date-time';
import { managementPath } from '@/router/management-navigation';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementReadFeedback from './component/ManagementReadFeedback.vue';
import OrganizationPolicy from './setting/OrganizationPolicy.vue';
import { useManagementOrganization } from './useManagementOrganization';

const workspace = useWorkspaceStore();
const { organizationId, organization, options, context } = useManagementOrganization(
    `${managementPath}/system-setting`
);
const policy = useOrganizationPolicy(context);
const deployment = useDeploymentInformation(context);
</script>

<template>
    <ManagementPage title="系统设置" layout="wide" :context="organization?.name ?? '组织不可用'">
        <template #actions>
            <div class="w-60 max-w-full [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-value]]:min-w-0">
                <SelectField v-model="organizationId" :options="options" label="当前管理组织" />
            </div>
        </template>
        <p v-if="!organization" role="alert" class="text-sm text-destructive">组织不存在或不在当前可访问范围内</p>
        <div v-else class="grid min-w-0 items-start gap-8 @4xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <ManagementSection title="组织治理规则">
                <ManagementReadFeedback
                    :loading="policy.loading.value"
                    :error="policy.error.value"
                    :stale="!!policy.data.value"
                    @retry="policy.refresh"
                />
                <Empty v-if="!policy.available" class="min-h-64 border-0 px-0">
                    <EmptyHeader>
                        <EmptyMedia variant="icon"><Settings aria-hidden="true" /></EmptyMedia>
                        <EmptyTitle>组织规则暂不可用</EmptyTitle>
                        <EmptyDescription>
                            组织治理服务尚未开放，当前不提供保留期、导出范围或默认规则的修改。
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
                <template v-else-if="policy.data.value">
                    <StateBadge>只读</StateBadge>
                    <OrganizationPolicy :policy="policy.data.value" />
                </template>
            </ManagementSection>
            <aside class="min-w-0 space-y-8 @4xl:border-l @4xl:pl-6">
                <ManagementSection title="系统信息">
                    <ManagementReadFeedback
                        :loading="deployment.loading.value"
                        :error="deployment.error.value"
                        :stale="!!deployment.data.value"
                        @retry="deployment.refresh"
                    />
                    <p v-if="!deployment.available" class="flex items-start gap-2 text-sm text-muted-foreground">
                        <Server class="size-4 shrink-0" aria-hidden="true" />
                        部署信息尚未提供
                    </p>
                    <dl
                        class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 text-sm [&>dt]:text-muted-foreground [&>dd]:break-words"
                    >
                        <template v-if="deployment.data.value">
                            <dt>系统版本</dt>
                            <dd>{{ deployment.data.value.version ?? '未提供' }}</dd>
                            <dt>构建时间</dt>
                            <dd>
                                {{
                                    deployment.data.value.builtAt
                                        ? formatDateTime(Date.parse(deployment.data.value.builtAt))
                                        : '未提供'
                                }}
                            </dd>
                            <dt>部署环境</dt>
                            <dd>{{ deployment.data.value.environmentLabel ?? '未提供' }}</dd>
                        </template>
                        <dt>管理组织</dt>
                        <dd>{{ organization.name }}</dd>
                        <dt>当前工作区</dt>
                        <dd>
                            {{
                                workspace.organization?.id === organization.id
                                    ? (workspace.current?.name ?? '未选择')
                                    : '未选择此组织工作区'
                            }}
                        </dd>
                    </dl>
                    <p class="text-xs text-muted-foreground">部署连接与运行参数由部署管理员维护，不属于组织规则。</p>
                </ManagementSection>
                <ManagementSection title="个人设置">
                    <Button variant="outline" as-child>
                        <RouterLink :to="`${managementPath}/account-setting`">
                            <UserRound aria-hidden="true" />
                            账户设置
                            <ArrowUpRight aria-hidden="true" />
                        </RouterLink>
                    </Button>
                </ManagementSection>
            </aside>
        </div>
    </ManagementPage>
</template>
