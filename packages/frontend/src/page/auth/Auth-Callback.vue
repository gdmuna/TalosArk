<template>
    <AuthPage :title="failed ? '未能完成登录' : '正在完成登录'">
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <p v-if="pending" role="status" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            正在完成登录
        </p>
        <Button v-if="failed" as-child variant="outline" class="mt-5 w-full">
            <RouterLink :to="{ path: '/auth/login', query: { next: destination } }">返回登录</RouterLink>
        </Button>
    </AuthPage>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authErrorMessage, takeOidcReturn, useAuthApi } from '@/module/auth';
import { AuthPage } from '@/module/auth/ui';
import { LoaderCircle } from '@lucide/vue';
import { Button } from '@/ui/button';
import { consumeQuery } from '@/platform/navigation';

const route = useRoute();
const router = useRouter();
const api = useAuthApi();
const error = ref('');
const pending = ref(true);
const failed = ref(false);
const destination = ref('/main');
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());

onMounted(async () => {
    const { code, state } = route.query;
    await consumeQuery(router, ['code', 'state']);
    if (controller.signal.aborted) return;
    if (typeof code !== 'string' || typeof state !== 'string' || !code || !state) {
        error.value = '登录链接无效或已使用，请重新发起企业 SSO 登录。';
        pending.value = false;
        failed.value = true;
        return;
    }
    destination.value = takeOidcReturn(state);
    try {
        const response = await api.completeOidcLogin({ code, state }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.type === 'block') {
            error.value = '当前账户无法登录';
            failed.value = true;
            return;
        }
        await router.replace(destination.value);
    } catch (cause) {
        if (!controller.signal.aborted) {
            failed.value = true;
            error.value = authErrorMessage(cause, '暂时无法完成登录，请重新发起企业 SSO 登录。');
        }
    } finally {
        pending.value = false;
    }
});
</script>
