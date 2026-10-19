<script setup lang="ts">
import type { OrganizationProfile } from '@/module/organization';
import { CopyableId } from '@/component/inspector';
import { StateBadge } from '@/component/state-badge';

defineProps<{ id: string; name: string; profile?: OrganizationProfile }>();
</script>

<template>
    <div class="flex min-w-0 flex-wrap items-start gap-4" data-slot="organization-identity">
        <div
            class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xl font-semibold text-primary-soft-foreground"
            aria-hidden="true"
        >
            {{ Array.from(profile?.name ?? name)[0] }}
        </div>
        <div class="min-w-0 flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
                <h2 class="min-w-0 break-words text-lg font-semibold">{{ profile?.name ?? name }}</h2>
                <StateBadge v-if="profile" :tone="profile.archivedAt ? 'neutral' : 'success'">
                    {{ profile.archivedAt ? '已归档' : '未归档' }}
                </StateBadge>
            </div>
            <CopyableId :value="id" label="组织 ID" />
        </div>
    </div>
</template>
