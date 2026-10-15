<script setup lang="ts">
defineProps<{ fields: { label: string; value?: string | number }[] }>();
</script>
<template>
    <div class="@container [contain-intrinsic-inline-size:40rem]">
        <dl class="grid grid-cols-1 gap-x-8 gap-y-5 @min-[1000px]:grid-cols-2">
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
