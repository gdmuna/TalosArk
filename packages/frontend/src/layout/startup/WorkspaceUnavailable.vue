<script setup lang="ts">
import { UsersRound } from '@lucide/vue';
import { Button } from '@/ui/button';
</script>

<template>
    <div
        data-slot="workspace-unavailable"
        class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
        <UsersRound class="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 class="text-lg font-medium">暂无可用工作区</h1>
        <Button as-child variant="outline">
            <RouterLink to="/main/management/account-setting">账户设置</RouterLink>
        </Button>
    </div>
</template>
