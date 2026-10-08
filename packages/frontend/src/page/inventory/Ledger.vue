<script setup lang="ts">
import { Package } from '@lucide/vue';
import ResourceList from '../resource/ResourceList.vue';
</script>
<template>
    <ResourceList
        title="库存实例"
        kind="库存实例"
        domain="inventory"
        :icon="Package"
        create-label="登记入库"
        :fields="[
            ['batch', '批次', 140],
            ['location', '存储位置', 200],
            ['quantity', '数量', 100],
            ['received', '入库时间', 180],
        ]"
    />
</template>
