<script setup lang="ts" generic="T extends { id: string }">
import { ChevronDown, ListChecks, X } from '@lucide/vue';
import { Button } from '@/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import type { DataTableBulkAction } from './types';

defineProps<{ rows: T[]; actions: DataTableBulkAction<T>[]; busy?: boolean }>();
const emit = defineEmits<{ clear: [] }>();
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" aria-label="批量操作" :disabled="!rows.length || busy">
                <ListChecks class="size-3.5" aria-hidden="true" />
                批量操作
                <!-- <span v-if="rows.length" class="text-xs tabular-nums">{{ rows.length }}</span> -->
                <span v-if="rows.length" class="rounded-sm bg-muted px-1 text-xs tabular-nums">
                    {{ rows.length }}
                </span>

                <ChevronDown class="size-3.5" aria-hidden="true" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-64" aria-label="批量操作">
            <DropdownMenuLabel>已选 {{ rows.length }} 项</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
                v-for="action in actions"
                :key="action.id"
                :disabled="busy || action.disabled?.(rows)"
                :aria-description="action.disabled?.(rows) ? action.disabledReason : undefined"
                @select="action.run([...rows])"
            >
                <component :is="action.icon" class="size-4" aria-hidden="true" />
                <span class="min-w-0">
                    <span class="block">{{ action.label }}</span>
                    <span v-if="action.disabled?.(rows) && action.disabledReason" class="mt-1 block text-xs">
                        {{ action.disabledReason }}
                    </span>
                </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="emit('clear')">
                <X aria-hidden="true" />
                取消选择
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>
