<script setup lang="ts">
import { Download } from '@lucide/vue';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import ResourceTable from '../resource/ResourceTable.vue';
</script>
<template>
    <ResourcePage label="出入库流水" layout="table">
        <template #actions>
            <Button variant="outline" disabled>
                <Download aria-hidden="true" />
                导出流水
            </Button>
        </template>
        <ResourceTable
            empty-text="出入库流水未加载"
            :fields="[
                ['time', '时间', 180],
                ['type', '流水类型', 120],
                ['object', '库存实例', 240],
                ['quantity', '数量变化', 120],
                ['from', '来源位置', 180],
                ['to', '目标位置', 180],
                ['operator', '操作人', 120],
            ]"
        />
    </ResourcePage>
</template>
