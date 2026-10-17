<script setup lang="ts">
defineProps<{ fields: { label: string; value: string | number | null | undefined }[] }>();
</script>
<template>
    <div class="@container/facts">
        <dl class="grid min-w-0 gap-x-6 gap-y-4 @min-[640px]/facts:grid-cols-2">
            <div
                v-for="field in fields"
                :key="field.label"
                class="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-3 text-sm"
            >
                <dt class="text-muted-foreground">{{ field.label }}</dt>
                <dd class="min-w-0 break-words whitespace-pre-wrap">{{ field.value ?? '—' }}</dd>
            </div>
        </dl>
    </div>
</template>
