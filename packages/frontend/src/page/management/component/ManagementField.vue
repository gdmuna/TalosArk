<script setup lang="ts">
import { useId } from 'vue';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
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
    <div class="space-y-2">
        <Label :for="id" :class="hideLabel && 'sr-only'">{{ label }}</Label>
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
    </div>
</template>
