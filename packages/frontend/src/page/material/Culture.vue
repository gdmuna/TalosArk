<script setup lang="ts">
import { Plus, ClipboardPen } from '@lucide/vue';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import ResourceTable from '../resource/ResourceTable.vue';
</script>
<template>
    <ResourcePage label="培养物" layout="table">
        <template #actions>
            <Button variant="outline" disabled>
                <ClipboardPen aria-hidden="true" />
                记录培养事件
            </Button>
            <Button disabled>
                <Plus aria-hidden="true" />
                登记培养物
            </Button>
        </template>
        <ResourceTable
            empty-text="培养物数据未加载"
            :fields="[
                ['culture', '培养物 ID', 200],
                ['material', '材料', 220],
                ['passage', '代次', 90],
                ['status', '培养状态', 130],
                ['location', '位置', 200],
                ['updated', '更新时间', 180],
            ]"
        />
    </ResourcePage>
</template>
