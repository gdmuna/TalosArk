<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { FlaskConical } from '@lucide/vue';
import { Button } from '@/ui/button';
import { prototypeEntry } from './prototype';
defineProps<{ kind: keyof typeof prototypeEntry }>();
</script>
<template>
    <Button as-child variant="outline">
        <RouterLink :to="prototypeEntry[kind]">
            <FlaskConical />
            模拟详情
        </RouterLink>
    </Button>
</template>
