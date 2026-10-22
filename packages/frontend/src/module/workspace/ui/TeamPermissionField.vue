<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import type { TeamManagement } from '@talos-ark/contracts/team';
import { Checkbox } from '@/ui/checkbox';
import { Input } from '@/ui/input';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@/ui/field';

const formFieldId = useId();

const props = defineProps<{ definitions: TeamManagement['definitions']; disabled: boolean }>();
const selected = defineModel<string[]>({ required: true });
const query = ref('');
const visible = computed(() => {
    const text = query.value.trim().toLocaleLowerCase();
    return props.definitions.filter((item) => `${item.name} ${item.code}`.toLocaleLowerCase().includes(text));
});
const checked = computed(() => {
    const count = visible.value.filter((item) => selected.value.includes(item.code)).length;
    return count === 0 ? false : count === visible.value.length ? true : 'indeterminate';
});
function toggleAll(value: boolean | 'indeterminate') {
    const codes = new Set(visible.value.map((item) => item.code));
    selected.value =
        value === true
            ? [...new Set([...selected.value, ...codes])]
            : selected.value.filter((code) => !codes.has(code));
}
function toggle(code: string, value: boolean | 'indeterminate') {
    selected.value =
        value === true ? [...new Set([...selected.value, code])] : selected.value.filter((item) => item !== code);
}
</script>

<template>
    <FieldSet class="min-w-0" :disabled="disabled">
        <FieldLegend class="mb-2 font-medium">权限目录</FieldLegend>
        <Input v-model="query" aria-label="搜索权限" placeholder="搜索权限" :disabled="disabled" />
        <Field orientation="horizontal" class="items-center border-b pb-3">
            <Checkbox
                :id="formFieldId + '-1'"
                aria-label="全选当前结果"
                :model-value="checked"
                :disabled="disabled || !visible.length"
                @update:model-value="toggleAll"
            />
            <FieldLabel :for="formFieldId + '-1'" class="font-normal">全选当前结果</FieldLabel>
            <span class="ml-auto text-xs text-muted-foreground">已选 {{ selected.length }} 项</span>
        </Field>
        <div class="max-h-60 overflow-y-auto scroll-smooth motion-reduce:scroll-auto">
            <Field v-for="item in visible" :key="item.code" orientation="horizontal" class="min-h-9 items-start py-2">
                <Checkbox
                    :id="formFieldId + '-2' + '-' + item.code"
                    class="mt-0.5"
                    :model-value="selected.includes(item.code)"
                    :disabled="disabled"
                    @update:model-value="(value) => toggle(item.code, value)"
                />
                <FieldLabel :for="formFieldId + '-2' + '-' + item.code" class="min-w-0 break-words font-normal">
                    {{ item.name }}
                </FieldLabel>
            </Field>
            <p v-if="!visible.length" class="py-5 text-center text-sm text-muted-foreground">
                {{ definitions.length ? '没有匹配的权限' : '当前作用域暂无可用权限' }}
            </p>
        </div>
    </FieldSet>
</template>
