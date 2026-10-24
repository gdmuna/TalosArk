<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { authErrorMessage, useAuthApi } from '@/module/auth';
import { AuthPage, PasswordForm } from '@/module/auth/ui';
import { HttpError } from '@/platform/http';
import { useAccountStore } from '@/module/account';
import { Button } from '@/ui/button';

const api = useAuthApi();
const router = useRouter();
const account = useAccountStore();
const pending = ref(false);
const error = ref('');
const blocked = ref(false);
const reauthenticate = ref(false);
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());
async function submit(password: string) {
    if (pending.value || blocked.value) return;
    pending.value = true;
    error.value = '';
    try {
        await api.setFirstPassword({ password }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        await router.replace('/main/management/account-setting');
    } catch (cause) {
        if (!controller.signal.aborted) {
            error.value = authErrorMessage(cause, '暂时无法确认设密结果。可稍后重试，或使用该密码尝试登录。');
            if (
                cause instanceof HttpError &&
                ['AUTH_PASSWORD_PRESENT', 'AUTH_REAUTHENTICATION_REQUIRED'].includes(cause.code ?? '')
            ) {
                blocked.value = true;
                reauthenticate.value = cause.code === 'AUTH_REAUTHENTICATION_REQUIRED';
            }
        }
    } finally {
        pending.value = false;
    }
}
</script>

<template>
    <AuthPage title="设置本地密码" description="为当前账户首次设置可用于登录的密码。">
        <p v-if="account.profile" class="mb-5 break-all text-sm text-muted-foreground">{{ account.profile.email }}</p>
        <template v-if="blocked">
            <p role="alert" class="text-sm text-muted-foreground">{{ error }}</p>
            <Button as-child class="mt-5 w-full">
                <RouterLink v-if="reauthenticate" :to="{ path: '/auth/login', query: { next: '/auth/set-password' } }">
                    重新认证
                </RouterLink>
                <RouterLink v-else to="/auth/recovery">找回密码</RouterLink>
            </Button>
        </template>
        <PasswordForm v-else :pending="pending" :error="error" label="保存密码" @submit="submit" />
        <Button as-child variant="link" class="mt-5 w-full">
            <RouterLink to="/main/management/account-setting">返回账户设置</RouterLink>
        </Button>
    </AuthPage>
</template>
