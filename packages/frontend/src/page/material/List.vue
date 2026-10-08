<script setup lang="ts">
import { FlaskConical } from '@lucide/vue';
import ResourceList from '../resource/ResourceList.vue';
</script>
<template>
    <ResourceList
        title="材料"
        kind="材料定义"
        domain="material"
        :icon="FlaskConical"
        create-label="新建材料"
        :fields="[
            ['type', '材料类型', 140],
            ['instances', '可用实例', 120],
            ['updated', '更新时间', 180],
        ]"
    />
</template>
