<script setup lang="ts">
import { Monitor } from '@lucide/vue';
import ResourceList from '../resource/ResourceList.vue';
</script>
<template>
    <ResourceList
        title="设备"
        kind="设备"
        domain="equipment"
        :icon="Monitor"
        create-label="添加设备"
        :fields="[
            ['type', '设备类型', 140],
            ['connection', '连接状态', 120],
            ['location', '安装位置', 200],
        ]"
    />
</template>
