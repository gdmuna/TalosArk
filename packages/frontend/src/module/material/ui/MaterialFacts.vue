<script setup lang="ts">
import { computed } from 'vue';
import type { Material } from '@talos-ark/contracts/material';
import { branchPresentation, materialDate } from '../model/presentation';
import { Badge } from '@/ui/badge';

const props = defineProps<{ material: Material }>();
const facts = computed(() => [
    { label: '材料编号', value: props.material.code },
    { label: '业务分支', value: branchPresentation(props.material.branch).label },
    { label: '材料分类', value: props.material.type.name + (props.material.type.archivedAt ? '（已归档）' : '') },
    { label: '计量单位', value: props.material.quantityUnit },
    { label: '数量小数位数', value: `${props.material.quantityScale} 位` },
    { label: '厂家', value: props.material.manufacturer },
    { label: '货号', value: props.material.catalogNumber },
    { label: '创建时间', value: materialDate(props.material.createdAt) },
    { label: '更新时间', value: materialDate(props.material.updatedAt) },
]);
const attributes = computed(() => props.material.attributes as Record<string, string>);
</script>
<template>
    <div class="space-y-7">
        <section class="space-y-4">
            <h3 class="border-b pb-3 font-semibold">基本信息</h3>
            <dl class="grid gap-x-8 gap-y-4 @min-[640px]:grid-cols-2">
                <div
                    v-for="field in facts"
                    :key="field.label"
                    class="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-3 text-sm"
                >
                    <dt class="text-muted-foreground">{{ field.label }}</dt>
                    <dd class="break-words">{{ field.value || '未填写' }}</dd>
                </div>
            </dl>
            <p class="whitespace-pre-wrap break-words text-sm leading-6">{{ material.description || '暂无描述' }}</p>
        </section>
        <section class="space-y-4">
            <h3 class="border-b pb-3 font-semibold">{{ branchPresentation(material.branch).label }}属性</h3>
            <dl class="space-y-4">
                <div
                    v-for="field in branchPresentation(material.branch).fields"
                    :key="field.key"
                    class="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-3 text-sm"
                >
                    <dt class="text-muted-foreground">{{ field.label }}</dt>
                    <dd class="break-words">{{ attributes[field.key] || '未填写' }}</dd>
                </div>
            </dl>
        </section>
        <section class="space-y-4">
            <h3 class="border-b pb-3 font-semibold">别名与外部标识</h3>
            <div v-if="material.aliases.length" class="flex flex-wrap gap-2">
                <Badge
                    v-for="alias in material.aliases"
                    :key="alias"
                    variant="secondary"
                    class="max-w-full whitespace-normal break-words"
                >
                    {{ alias }}
                </Badge>
            </div>
            <p v-else class="text-sm text-muted-foreground">未填写别名</p>
            <dl v-if="material.identifiers.length" class="space-y-3">
                <div
                    v-for="identifier in material.identifiers"
                    :key="JSON.stringify(identifier)"
                    class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 text-sm"
                >
                    <dt class="font-mono text-muted-foreground">{{ identifier.scheme }}</dt>
                    <dd class="break-all">{{ identifier.value }}</dd>
                </div>
            </dl>
            <p v-else class="text-sm text-muted-foreground">未填写外部标识</p>
        </section>
    </div>
</template>
