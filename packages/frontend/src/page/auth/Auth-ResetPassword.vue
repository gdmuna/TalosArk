<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from '@lucide/vue';
import { PasswordRecoveryTokenSchema } from '@talos-ark/contracts/auth';
import { authReturnPath, useAuthApi } from '@/module/auth';
import { AuthPage, PasswordForm } from '@/module/auth/ui';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { Button } from '@/ui/button';

const route = useRoute();
const router = useRouter();
const api = useAuthApi();
const token = ref('');
const pending = ref(false);
const completed = ref(false);
const ready = ref(false);
const error = ref('');
let revision = 0;
let controller: AbortController | undefined;

watch(
    () => route.hash,
    async (hash) => {
        if (!hash) return;
        const current = ++revision;
        controller?.abort();
        const values = new URLSearchParams(hash.slice(1)).getAll('token');
        const parsed = PasswordRecoveryTokenSchema.safeParse(values.length === 1 ? values[0] : undefined);
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
    const request = new AbortController();
    controller = request;
    pending.value = true;
    error.value = '';
    try {
        await api.confirmPasswordRecovery({ token: token.value, password }, { signal: request.signal });
        if (current !== revision) return;
        completed.value = true;
        token.value = '';
    } catch (cause) {
        if (current !== revision || request.signal.aborted) return;
        if (isResponseValidationError(cause)) return;
        if (cause instanceof HttpError && cause.code === 'AUTH_PASSWORD_RECOVERY_INVALID') token.value = '';
        else if (cause instanceof HttpError && cause.code === 'AUTH_PASSWORD_REJECTED')
            error.value = '请换一个不易被猜到的密码。';
        else if (cause instanceof HttpError && cause.status === 429) error.value = '尝试过于频繁，请稍后再试。';
        else error.value = '暂时无法确认结果。可稍后重试；若链接已失效，请尝试使用新密码登录或重新申请。';
    } finally {
        if (current === revision) pending.value = false;
    }
}
</script>

<template>
    <AuthPage :title="completed ? '密码已重设' : '重设密码'">
        <p v-if="completed" role="status" class="text-sm leading-6 text-muted-foreground">
            原有登录会话已失效，请使用新密码重新登录。
        </p>
        <PasswordForm
            v-else-if="token && ready"
            :key="token"
            :pending="pending"
            :error="error"
            label="确认重设密码"
            password-label="新密码"
            @submit="submit"
        />
        <p v-else-if="token" role="status" class="text-sm text-muted-foreground">正在读取重设链接</p>
        <p v-else role="alert" class="text-sm text-muted-foreground">该链接无效或已过期，请重新申请重设密码。</p>
        <Button v-if="!completed" as-child variant="link" class="mt-5 h-auto px-0 font-normal">
            <RouterLink :to="{ path: '/auth/recovery', query: { next: authReturnPath(route.query.next) } }">
                重新申请
            </RouterLink>
        </Button>
        <Button as-child :variant="completed ? 'default' : 'link'" class="mt-5 w-full">
            <RouterLink :to="{ path: '/auth/login', query: { next: authReturnPath(route.query.next) } }">
                <ArrowLeft class="size-4" aria-hidden="true" />
                返回登录
            </RouterLink>
        </Button>
    </AuthPage>
</template>
