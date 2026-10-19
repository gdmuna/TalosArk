<script setup lang="ts">
import { computed } from 'vue';
import { Bell, Mail, Radio, Check, Minus } from '@lucide/vue';
import type { NotificationChannel, NotificationChannelRule } from '@/module/notification';

const props = defineProps<{ channels: NotificationChannel[]; rules: NotificationChannelRule[] }>();
const items = computed(() =>
    props.rules.map((rule) => ({ ...rule, channel: props.channels.find((channel) => channel.id === rule.channelId) }))
);
</script>

<template>
    <ul v-if="items.length" class="space-y-3 text-sm">
        <li v-for="rule in items" :key="rule.channelId" class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
                <component
                    :is="rule.channelId === 'site' ? Bell : rule.channelId === 'email' ? Mail : Radio"
                    class="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                />
                <span>{{ rule.channel?.label }}</span>
                <component :is="rule.enabled ? Check : Minus" class="size-3.5 shrink-0" aria-hidden="true" />
                <span :class="rule.enabled ? '' : 'text-muted-foreground'">
                    {{ rule.enabled === null ? '启用状态未知' : rule.enabled ? '已启用' : '未启用' }}
                </span>
            </div>
            <p
                v-if="rule.channel && rule.channel.availability !== 'available'"
                class="break-words text-xs text-muted-foreground"
            >
                {{ rule.channel.availability === 'unavailable' ? '渠道不可用' : '渠道状态未知' }} ·
                {{ rule.channel.reason ?? '未提供原因' }}
            </p>
        </li>
    </ul>
    <span v-else class="text-muted-foreground">未提供渠道规则</span>
</template>
