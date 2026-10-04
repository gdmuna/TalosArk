<template></template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { axiosInstance } from '@/shared/api/client';

const route = useRoute();
const router = useRouter();

onMounted(async () => {
    const { code, state } = route.query;
    if (!code || !state) {
        router.push('/');
        console.error('OIDC 回调缺少 code 或 state');
    }
    await axiosInstance.post<any, any>('auth/oidc/login-callback', {
        code,
        state,
    });
    router.push('/');
});
</script>

<style scoped></style>
