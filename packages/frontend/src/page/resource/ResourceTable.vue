<script setup lang="ts">
import { computed } from 'vue';
import { DataTable, type DataTableColumn } from '@/component/data-table';

const props = withDefaults(defineProps<{ fields: [string, string, number][]; emptyText?: string }>(), {
    emptyText: '数据未加载',
});
type Row = { id: string };
const rows: Row[] = [];
const columns = computed<DataTableColumn<Row>[]>(() =>
    props.fields.map(([id, label, size]) => ({
        id,
        label,
        size,
        value: () => '—',
    }))
);
</script>
<template>
    <DataTable :data="rows" :columns="columns" :empty-text="emptyText" />
</template>
