<script setup lang="ts">
import type { Component } from 'vue';
import { Eye, EllipsisVertical } from '@lucide/vue';
import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/dropdown-menu';

defineProps<{
    name: string;
    disabled: boolean;
    detail?: () => void;
    actions: { label: string; icon: Component; run: () => void; destructive?: boolean }[];
}>();
defineEmits<{ preview: [] }>();
</script>

<template>
    <div class="flex items-center justify-end gap-1">
        <Button
            size="sm"
            :aria-label="`${detail ? '详情' : '预览'}：${name}`"
            @click="detail ? detail() : $emit('preview')"
        >
            {{ detail ? '详情' : '预览' }}
        </Button>
        <DropdownMenu>
            <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon-sm" use-tooltip :aria-label="`更多操作：${name}`">
                    <EllipsisVertical />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem v-if="detail" @select="detail">
                    <Eye />
                    详情
                </DropdownMenuItem>
                <DropdownMenuItem @select="$emit('preview')">
                    <Eye />
                    预览
                </DropdownMenuItem>
                <DropdownMenuItem
                    v-for="action in actions"
                    :key="action.label"
                    :disabled="disabled"
                    :variant="action.destructive ? 'destructive' : 'default'"
                    @select="action.run"
                >
                    <component :is="action.icon" />
                    {{ action.label }}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </div>
</template>
