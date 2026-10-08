<template>
    <p v-if="error" role="alert" class="p-6 text-destructive">{{ error }}</p>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthApi } from '@/module/auth';

const route = useRoute();
const router = useRouter();
const api = useAuthApi();
const error = ref('');
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());

onMounted(async () => {
    const { code, state } = route.query;
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
        await router.push('/');
    } catch (cause) {
        if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : '登录失败';
    }
});
</script>

<style scoped></style>
