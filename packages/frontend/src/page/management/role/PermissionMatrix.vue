<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import type { TeamManagement } from '@talos-ark/contracts/team';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/ui/table';
import { Field, FieldLabel } from '@/ui/field';

const formFieldId = useId();

const props = defineProps<{ definitions: TeamManagement['definitions']; disabled: boolean; scope: string }>();
const selected = defineModel<string[]>({ required: true });
const query = ref('');
const visible = computed(() =>
    props.definitions.filter((item) =>
        `${item.name} ${item.code}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())
    )
);
const checked = computed(() => {
    const count = visible.value.filter((item) => selected.value.includes(item.code)).length;
    return count === 0 ? false : count === visible.value.length ? true : 'indeterminate';
});
function toggle(code: string, value: boolean | 'indeterminate') {
    selected.value =
        value === true ? [...new Set([...selected.value, code])] : selected.value.filter((item) => item !== code);
}
function toggleAll(value: boolean | 'indeterminate') {
    const codes = visible.value.map((item) => item.code);
    selected.value =
        value === true
            ? [...new Set([...selected.value, ...codes])]
            : selected.value.filter((item) => !codes.includes(item));
}
</script>
<template>
    <div class="space-y-4">
        <Input v-model="query" aria-label="搜索角色权限" placeholder="搜索权限名称或代码" class="max-w-80" />
        <div tabindex="0" role="region" aria-label="权限矩阵滚动区域" class="max-h-96 overflow-auto rounded-md border">
            <Table container-class="overflow-visible" aria-label="角色定义权限矩阵">
                <TableHeader>
                    <TableRow>
                        <TableHead class="sticky top-0 left-0 z-30 min-w-36 bg-card">作用域</TableHead>
                        <TableHead
                            v-for="definition in visible"
                            :key="definition.code"
                            class="sticky top-0 z-20 min-w-36 bg-card text-center"
                        >
                            {{ definition.name }}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow v-if="visible.length">
                        <TableCell class="sticky left-0 z-10 bg-card">
                            <Field orientation="horizontal" class="items-center">
                                <Checkbox
                                    :id="formFieldId + '-1'"
                                    :model-value="checked"
                                    :disabled="disabled"
                                    aria-label="全选当前权限结果"
                                    @update:model-value="toggleAll"
                                />
                                <FieldLabel :for="formFieldId + '-1'" class="font-normal">{{ scope }}</FieldLabel>
                            </Field>
                        </TableCell>
                        <TableCell v-for="definition in visible" :key="definition.code" class="text-center">
                            <Checkbox
                                :aria-label="definition.name"
                                :model-value="selected.includes(definition.code)"
                                :disabled="disabled"
                                @update:model-value="(value) => toggle(definition.code, value)"
                            />
                        </TableCell>
                    </TableRow>
                    <TableRow v-else>
                        <TableCell class="h-28 text-center text-muted-foreground">没有匹配的已注册权限</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    </div>
</template>
