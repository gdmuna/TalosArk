<template>
    <div class="flex size-full flex-col items-center justify-center gap-3 p-6">
        <template v-if="error">
            <p role="alert" class="text-destructive">{{ error }}</p>
            <Button as-child variant="outline"><RouterLink to="/auth/login">返回登录</RouterLink></Button>
        </template>
        <p v-else role="status" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
            正在完成登录
        </p>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authErrorMessage, useAuthApi } from '@/module/auth';
import { LoaderCircle } from '@lucide/vue';
import { Button } from '@/ui/button';
import { consumeQuery } from '@/platform/navigation';

const route = useRoute();
const router = useRouter();
const api = useAuthApi();
const error = ref('');
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());

onMounted(async () => {
    const { code, state } = route.query;
    await consumeQuery(router, ['code', 'state']);
    if (typeof code !== 'string' || typeof state !== 'string' || !code || !state) {
        error.value = 'OIDC 回调缺少有效的 code 或 state';
        return;
    }
    try {
        const response = await api.completeOidcLogin({ code, state }, { signal: controller.signal });
        if (response.type === 'block') {
            error.value = '当前账户无法登录';
            return;
        }
        await router.replace('/');
    } catch (cause) {
        if (!controller.signal.aborted) error.value = authErrorMessage(cause, '暂时无法完成登录，请重试。');
    }
});
</script>

<style scoped></style>
