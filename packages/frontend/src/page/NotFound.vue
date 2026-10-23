<script setup lang="ts">
import { FileQuestion, ArrowLeft, House } from '@lucide/vue';
import { useRoute } from 'vue-router';
import { useNavigationStore } from '@/platform/navigation';
import { Button } from '@/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/ui/empty';

const route = useRoute();
const navigation = useNavigationStore();
</script>

<template>
    <main class="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-y-auto p-6">
        <Empty class="max-w-md border-0">
            <EmptyHeader>
                <EmptyMedia variant="icon"><FileQuestion aria-hidden="true" /></EmptyMedia>
                <EmptyTitle><h1>找不到此页面</h1></EmptyTitle>
                <EmptyDescription>页面地址可能有误或已发生变更。</EmptyDescription>
            </EmptyHeader>
            <p class="max-w-full break-all text-sm text-muted-foreground">{{ route.path }}</p>
            <EmptyContent class="flex-row flex-wrap justify-center gap-2">
                <Button v-if="navigation.canBack" variant="outline" @click="navigation.back">
                    <ArrowLeft aria-hidden="true" />
                    返回上一页
                </Button>
                <Button as-child>
                    <RouterLink to="/main">
                        <House aria-hidden="true" />
                        返回工作台
                    </RouterLink>
                </Button>
            </EmptyContent>
        </Empty>
    </main>
</template>
