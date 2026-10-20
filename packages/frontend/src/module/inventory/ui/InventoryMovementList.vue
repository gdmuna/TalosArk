<script setup lang="ts">
import { ArrowRight, ArrowLeftRight } from '@lucide/vue';
import { computed } from 'vue';
import type { InventoryTransaction } from '../data/source';
import { inventoryTransactionLabel } from '../model/presentation';

const props = defineProps<{ items: InventoryTransaction[]; stockItemId?: string }>();
defineEmits<{ select: [id: string] }>();
const entries = computed(() =>
    props.items.map((item) => {
        const lines = props.stockItemId
            ? item.lines.filter((line) => line.stockItemId === props.stockItemId)
            : item.lines;
        return { item, first: lines[0], count: lines.length };
    })
);
</script>

<template>
    <ol class="divide-y border-y">
        <li v-for="{ item, first, count } in entries" :key="item.id">
            <button
                class="group flex w-full min-w-0 items-start gap-3 px-2 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                :aria-label="`查看${inventoryTransactionLabel(item.type)}流水`"
                @click="$emit('select', item.id)"
            >
                <ArrowLeftRight class="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span class="min-w-0 flex-1 space-y-1.5">
                    <span class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span class="font-medium group-hover:underline">
                            {{ inventoryTransactionLabel(item.type) }}
                        </span>
                        <time :datetime="item.occurredAt" class="text-xs tabular-nums text-muted-foreground">
                            {{ new Date(item.occurredAt).toLocaleString('zh-CN', { hour12: false }) }}
                        </time>
                    </span>
                    <span v-if="first" class="block text-sm tabular-nums">
                        {{ first.quantityBefore }} → {{ first.quantityAfter }} {{ first.unitSnapshot }}
                        <span v-if="count > 1" class="text-muted-foreground">等 {{ count }} 项</span>
                    </span>
                    <span
                        v-if="
                            first &&
                            (first.fromNodePathSnapshot ||
                                first.toNodePathSnapshot ||
                                first.fromLocationRestricted ||
                                first.toLocationRestricted)
                        "
                        class="block break-words text-xs leading-5 text-muted-foreground"
                    >
                        {{ first.fromLocationRestricted ? '位置受限' : (first.fromNodePathSnapshot ?? '无来源位置') }} →
                        {{ first.toLocationRestricted ? '位置受限' : (first.toNodePathSnapshot ?? '无目标位置') }}
                    </span>
                    <span v-if="item.reason" class="block break-words text-xs leading-5 text-muted-foreground">
                        {{ item.reason }}
                    </span>
                </span>
                <ArrowRight class="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
        </li>
    </ol>
</template>
