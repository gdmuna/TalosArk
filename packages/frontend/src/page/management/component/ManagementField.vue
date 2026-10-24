<script setup lang="ts">
import { useId } from 'vue';
import { Input } from '@/ui/input';
import { Field, FieldLabel } from '@/ui/field';
import { Textarea } from '@/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

defineProps<{
    label: string;
    value?: string;
    options?: readonly string[];
    multiline?: boolean;
    type?: 'text' | 'email' | 'number' | 'url';
    placeholder?: string;
    hideLabel?: boolean;
}>();
const id = useId();
</script>

<template>
    <Field>
        <FieldLabel :for="id" :class="hideLabel && 'sr-only'">{{ label }}</FieldLabel>
        <Select v-if="options" :model-value="value" disabled>
            <SelectTrigger :id="id" class="w-full bg-card">
                <SelectValue :placeholder="placeholder ?? '未设置'" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem v-for="option in options" :key="option" :value="option">{{ option }}</SelectItem>
            </SelectContent>
        </Select>
        <Textarea
            v-else-if="multiline"
            :id="id"
            :model-value="value"
            :placeholder="placeholder ?? '未设置'"
            class="min-h-24 bg-card"
            readonly
        />
        <Input
            v-else
            :id="id"
            :type="type ?? 'text'"
            :model-value="value"
            :placeholder="placeholder ?? '未设置'"
            class="bg-card"
            readonly
        />
    </Field>
</template>
