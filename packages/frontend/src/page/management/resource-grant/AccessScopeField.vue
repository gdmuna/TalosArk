<script setup lang="ts">
import type { AccessOption } from '@/module/resource-access';
import { SelectField } from '@/component/select-field';
defineProps<{ options: AccessOption[]; label: string }>();
const value = defineModel<string>({ required: true });
</script>
<template>
    <div class="w-60 max-w-full [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-value]]:min-w-0">
        <SelectField v-model="value" :label="label" :options="options" />
    </div>
</template>
