<script setup lang="ts">
import type { ResourceGrant, AccessScope } from '@/module/resource-access';
import { CopyableId } from '@/component/inspector';
import { StateBadge } from '@/component/state-badge';
import { Button } from '@/ui/button';
import ManagementSection from '../component/ManagementSection.vue';
import FactList from '../detail/FactList.vue';
import { accessReferenceTo } from './context';
import { accessDate, grantStates, grantValidity, principalKinds } from './presentation';
defineProps<{ grant: ResourceGrant; scope: AccessScope }>();
</script>
<template>
    <div class="space-y-6">
        <ManagementSection title="资源与授权对象">
            <div class="flex flex-wrap items-center gap-2">
                <h3 class="break-words font-medium">{{ grant.resource.name }}</h3>
                <StateBadge :tone="grantStates[grant.status].tone">{{ grantStates[grant.status].label }}</StateBadge>
            </div>
            <CopyableId :value="grant.resource.id" label="资源 ID" />
            <FactList
                :fields="[
                    { label: '资源类型', value: grant.resource.type.label },
                    { label: '资源编号', value: grant.resource.code },
                    { label: '所属工作区', value: grant.resource.workspace.name },
                    { label: '主体类型', value: principalKinds[grant.principal.kind] },
                ]"
            />
            <Button
                v-if="grant.principal.reference"
                variant="link"
                class="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                as-child
            >
                <RouterLink :to="accessReferenceTo(scope, grant.principal.reference)">
                    {{ grant.principal.name }}
                </RouterLink>
            </Button>
            <p v-else class="break-words text-sm">{{ grant.principal.name }}</p>
        </ManagementSection>
        <ManagementSection title="权限与来源">
            <ul class="flex flex-wrap gap-2" aria-label="授权动作">
                <li
                    v-for="permission in grant.permissions"
                    :key="permission.code"
                    class="rounded-sm bg-muted px-2 py-1 text-sm"
                >
                    {{ permission.label }}
                </li>
            </ul>
            <p v-if="!grant.permissions.length" class="text-sm text-muted-foreground">未返回可展示的授权动作</p>
            <Button
                v-if="grant.basis.reference"
                variant="link"
                class="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                as-child
            >
                <RouterLink :to="accessReferenceTo(scope, grant.basis.reference)">{{ grant.basis.label }}</RouterLink>
            </Button>
            <p v-else class="break-words text-sm font-medium">{{ grant.basis.label }}</p>
            <p v-if="grant.basis.description" class="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {{ grant.basis.description }}
            </p>
        </ManagementSection>
        <ManagementSection title="授权记录">
            <CopyableId :value="grant.id" label="记录 ID" />
            <FactList
                :fields="[
                    { label: '授权时间', value: accessDate(grant.grantedAt) },
                    { label: '有效期', value: grantValidity(grant.expiresAt) },
                    { label: '授权人', value: grant.grantedBy ?? '未提供' },
                ]"
            />
            <p v-if="grant.description" class="whitespace-pre-wrap break-words text-sm">{{ grant.description }}</p>
        </ManagementSection>
    </div>
</template>
