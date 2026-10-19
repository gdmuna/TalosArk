<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { ArrowLeft } from '@lucide/vue';
import { Button } from '@/ui/button';
import { workbenchPage } from '../navigation';

const route = useRoute();
const page = computed(() => Object.values(workbenchPage).find((item) => item.path === route.matched.at(-1)?.path));
</script>

<template>
    <div class="flex min-h-72 flex-col items-center justify-center gap-4 p-6 text-center">
        <component :is="page?.icon" class="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 class="text-lg font-medium">{{ page?.label }}尚未开放</h1>
        <p class="max-w-sm text-sm text-muted-foreground">对应业务服务尚未接入，当前无法读取或处理工作队列。</p>
        <Button as-child variant="outline">
            <RouterLink :to="workbenchPage.overview.path">
                <ArrowLeft aria-hidden="true" />
                返回工作台概览
            </RouterLink>
        </Button>
    </div>
</template>
