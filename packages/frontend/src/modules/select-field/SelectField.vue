<script setup lang="ts">
import { useId } from 'vue';
import { PopoverTitle } from '@/ui/popover';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/ui/select';

defineProps<{
    label: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    disabled?: boolean;
    hideTitle?: boolean;
}>();
const model = defineModel<string>({ required: true });
const titleId = useId();
</script>

<template>
    <Select v-model="model" :disabled="disabled">
        <SelectTrigger class="h-9 min-w-32 max-w-full rounded-md bg-card" :aria-label="label">
            <SelectValue :placeholder="label" />
        </SelectTrigger>
        <SelectContent
            position="popper"
            side="bottom"
            align="start"
            :side-offset="6"
            :aria-labelledby="hideTitle ? undefined : titleId"
            :aria-label="hideTitle ? label : undefined"
        >
            <template v-if="!hideTitle">
                <PopoverTitle :id="titleId" class="flex items-center gap-1 px-2.5 py-2 text-sm">
                    {{ label }}
                    <slot name="title-after" />
                </PopoverTitle>
                <SelectSeparator />
            </template>
            <SelectItem v-for="option in options" :key="option.value" :value="option.value" class="min-h-8 pl-2.5 pr-8">
                {{ option.label }}
            </SelectItem>
        </SelectContent>
    </Select>
</template>
