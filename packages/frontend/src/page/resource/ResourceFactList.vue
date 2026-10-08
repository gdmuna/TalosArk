<script setup lang="ts">
defineProps<{ fields: { label: string; value?: string | number }[] }>();
</script>
<template>
    <div class="@container">
        <dl class="grid grid-cols-1 gap-x-8 gap-y-5 @2xl:grid-cols-2">
            <div
                v-for="field in fields"
                :key="field.label"
                class="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-3 text-sm"
            >
                <dt class="text-muted-foreground">{{ field.label }}</dt>
                <dd class="break-words whitespace-pre-wrap">{{ field.value ?? '未加载' }}</dd>
            </div>
        </dl>
    </div>
</template>
