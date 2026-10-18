<script setup lang="ts">
import ResourceDomain from '../resource/ResourceDomain.vue';
import { Plus } from '@lucide/vue';
import { ref, watch } from 'vue';
import { Tags } from '@lucide/vue';
import { MaterialEditor, MaterialTypeManager, useMaterialStore } from '@/module/material';
import { Button } from '@/ui/button';
import { useQueryCommand } from '@/platform/navigation';
const store = useMaterialStore();
const creating = ref(false),
    managingTypes = ref(false);
const pendingCreate = ref(false);
useQueryCommand('create', (value) => {
    pendingCreate.value = value === '1';
});
watch(
    [pendingCreate, () => store.capabilities],
    ([pending, capabilities]) => {
        if (!pending || !capabilities) return;
        pendingCreate.value = false;
        if (capabilities.create) creating.value = true;
    },
    { immediate: true }
);
watch(
    () => store.scope,
    () => {
        pendingCreate.value = false;
    }
);
</script>
<template>
    <ResourceDomain domain="material">
        <template #actions>
            <Button v-if="store.capabilities?.manageType" variant="outline" @click="managingTypes = true">
                <Tags />
                管理分类
            </Button>
            <Button :disabled="!store.capabilities?.create" @click="creating = true">
                <Plus aria-hidden="true" />
                新建材料
            </Button>
        </template>
    </ResourceDomain>
    <MaterialEditor v-model:open="creating" />
    <MaterialTypeManager v-if="managingTypes" v-model:open="managingTypes" />
</template>
