<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TeamManagement } from '@talos-ark/contracts/team';
import { Checkbox } from '@/ui/checkbox';
import { Input } from '@/ui/input';

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
    <fieldset class="min-w-0 space-y-3" :disabled="disabled">
        <legend class="mb-2 text-sm font-medium">权限目录</legend>
        <Input v-model="query" aria-label="搜索权限" placeholder="搜索权限" :disabled="disabled" />
        <label class="flex items-center gap-3 border-b pb-3 text-sm">
            <Checkbox
                aria-label="全选当前结果"
                :model-value="checked"
                :disabled="disabled || !visible.length"
                @update:model-value="toggleAll"
            />
            全选当前结果
            <span class="ml-auto text-xs text-muted-foreground">已选 {{ selected.length }} 项</span>
        </label>
        <div class="max-h-60 overflow-y-auto scroll-smooth motion-reduce:scroll-auto">
            <label v-for="item in visible" :key="item.code" class="flex min-h-9 items-start gap-3 py-2 text-sm">
                <Checkbox
                    class="mt-0.5"
                    :model-value="selected.includes(item.code)"
                    :disabled="disabled"
                    @update:model-value="(value) => toggle(item.code, value)"
                />
                <span class="min-w-0 break-words">{{ item.name }}</span>
            </label>
            <p v-if="!visible.length" class="py-5 text-center text-sm text-muted-foreground">
                {{ definitions.length ? '没有匹配的权限' : '当前作用域暂无可用权限' }}
            </p>
        </div>
    </fieldset>
</template>
