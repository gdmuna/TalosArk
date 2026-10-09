<script setup lang="ts">
import ResourceDomain from '../resource/ResourceDomain.vue';
import { Plus } from '@lucide/vue';
import { Button } from '@/ui/button';
</script>
<template>
    <ResourceDomain domain="material">
        <template #actions>
            <Button disabled>
                <Plus aria-hidden="true" />
                新建材料
            </Button>
        </template>
    </ResourceDomain>
</template>
