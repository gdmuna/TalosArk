<template></template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { axiosInstance } from '@/shared/api/client';

const route = useRoute();
const router = useRouter();

onMounted(async () => {
    const { code, state } = route.query;
    console.log(route.query);
    if (!code || !state) {
        router.push('/');
        console.error('wtf');
    }
    const res = await axiosInstance.post<any, any>('auth/oidc/login-callback', {
        code,
        state,
    });
    console.log(res);
    router.push('/');
});
</script>

<style scoped></style>
