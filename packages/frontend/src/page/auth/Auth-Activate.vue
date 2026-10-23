<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AccountActivateBodySchema } from '@talos-ark/contracts/auth';
import { authErrorMessage, useAuthApi } from '@/module/auth';
import { AuthPage, PasswordForm } from '@/module/auth/ui';
import { Button } from '@/ui/button';
import { HttpError } from '@/platform/http';

const route = useRoute();
const router = useRouter();
const api = useAuthApi();
const token = ref('');
const pending = ref(false);
const completed = ref(false);
const ready = ref(false);
const error = ref('');
let controller: AbortController | undefined;
let revision = 0;
watch(
    () => route.hash,
    async (hash) => {
        if (!hash) return;
        const current = ++revision;
        controller?.abort();
        const values = new URLSearchParams(hash.slice(1)).getAll('token');
        const parsed = AccountActivateBodySchema.shape.token.safeParse(values.length === 1 ? values[0] : undefined);
        token.value = parsed.success ? parsed.data : '';
        ready.value = pending.value = completed.value = false;
        error.value = '';
        await router.replace({ path: route.path, query: route.query, hash: '' });
        if (current === revision) ready.value = true;
    },
    { immediate: true }
);
onBeforeUnmount(() => {
    revision++;
    controller?.abort();
    token.value = '';
});

async function submit(password: string) {
    if (pending.value || !ready.value || !token.value) return;
    const current = ++revision;
    controller = new AbortController();
    const signal = controller.signal;
    pending.value = true;
    error.value = '';
    try {
        await api.activateAccount({ token: token.value, password }, { signal });
        if (current !== revision) return;
        completed.value = true;
        token.value = '';
    } catch (cause) {
        if (current === revision && !signal.aborted) {
            if (cause instanceof HttpError && cause.code === 'AUTH_ACTIVATION_INVALID') token.value = '';
            error.value = authErrorMessage(cause, '暂时无法确认激活结果。可稍后重试，或尝试使用新密码登录。');
        }
    } finally {
        if (current === revision) pending.value = false;
    }
}
</script>

<template>
    <AuthPage :title="completed ? '账户已激活' : '激活账户'">
        <p v-if="completed" role="status" class="mt-3 text-sm text-muted-foreground">请使用账号或邮箱及新密码登录。</p>
        <PasswordForm
            v-else-if="token && ready"
            :key="token"
            class="mt-6"
            :pending="pending"
            :error="error"
            label="设置密码并激活"
            @submit="submit"
        />
        <p v-else-if="token && !ready" role="status" class="mt-3 text-sm text-muted-foreground">正在读取激活链接</p>
        <p v-else role="alert" class="mt-3 text-sm text-muted-foreground">激活链接无效，请联系开户管理员。</p>
        <Button as-child :variant="completed ? 'default' : 'link'" class="mt-5 w-full">
            <RouterLink to="/auth/login">返回登录</RouterLink>
        </Button>
    </AuthPage>
</template>
