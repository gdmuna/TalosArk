<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { Search, ChevronLeft, ChevronRight } from '@lucide/vue';
import { useFacilityDataSource, useFacilityRead } from '../model/read';
import type { FacilityScope } from '../data/source';
import { SelectField } from '@/component/select-field';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import ReadFeedback from './ReadFeedback.vue';
import { Field, FieldLabel } from '@/ui/field';
const fieldId = useId();
const props = defineProps<{ scope: FacilityScope; contextKey: string; label?: string }>();
const model = defineModel<string>({ required: true });
const source = useFacilityDataSource();
const draft = ref(''),
    query = ref(''),
    page = ref(1);
watch(
    () => props.contextKey,
    () => {
        draft.value = query.value = '';
        page.value = 1;
    },
    { flush: 'sync' }
);
const key = computed(() =>
    source && props.contextKey ? JSON.stringify([props.contextKey, props.scope, query.value, page.value]) : ''
);
const { data, error, loading, refresh } = useFacilityRead(
    key,
    (signal) =>
        source?.list(props.scope, { q: query.value, state: 'all', page: page.value, pageSize: 20 }, signal) ??
        Promise.resolve(undefined)
);
const options = computed(() => {
    const items = data.value?.items.map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` })) ?? [];
    if (model.value && !items.some((item) => item.value === model.value))
        items.unshift({ value: model.value, label: props.label ?? model.value });
    return items;
});
function search() {
    query.value = draft.value.trim();
    page.value = 1;
}
</script>
<template>
    <div class="space-y-2">
        <div class="flex items-center gap-2">
            <Input
                v-model="draft"
                aria-label="搜索设施"
                placeholder="搜索设施名称、编号或位置"
                maxlength="160"
                class="min-w-0"
                @keydown.enter.prevent="search"
            />
            <Button type="button" variant="outline" size="icon-sm" use-tooltip title="搜索设施" @click="search">
                <Search aria-hidden="true" />
            </Button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <Field class="min-w-0 flex-1">
                <FieldLabel :for="fieldId" class="sr-only">设施</FieldLabel>
                <SelectField
                    :id="fieldId"
                    v-model="model"
                    label="设施"
                    hide-title
                    :options="options"
                    :disabled="loading"
                    class="w-full min-w-0"
                />
            </Field>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                use-tooltip
                title="上一页设施"
                :disabled="loading || page === 1"
                @click="page--"
            >
                <ChevronLeft aria-hidden="true" />
            </Button>
            <span class="text-xs text-muted-foreground">{{ page }}</span>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                use-tooltip
                title="下一页设施"
                :disabled="loading || !!error || page * 20 >= (data?.total ?? 0)"
                @click="page++"
            >
                <ChevronRight aria-hidden="true" />
            </Button>
        </div>
        <ReadFeedback :error="error" :loading="loading" @retry="refresh" />
        <p v-if="data && !data.total" class="text-sm text-muted-foreground">没有可访问的匹配设施</p>
    </div>
</template>
