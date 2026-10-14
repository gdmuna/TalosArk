<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Box } from '@lucide/vue';
import { authErrorMessage, useAuthApi } from '@/module/auth';
import { PasswordForm } from '@/module/auth/ui';
import { Button } from '@/ui/button';

const api = useAuthApi();
const router = useRouter();
const pending = ref(false);
const error = ref('');
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());
async function submit(password: string) {
    if (pending.value) return;
    pending.value = true;
    error.value = '';
    try {
        await api.setFirstPassword({ password }, { signal: controller.signal });
        await router.replace('/main/management/account-setting');
    } catch (cause) {
        if (!controller.signal.aborted)
            error.value = authErrorMessage(cause, '暂时无法确认设密结果。可稍后重试，或使用该密码尝试登录。');
    } finally {
        pending.value = false;
    }
}
</script>

<template>
    <main class="flex min-h-full w-full items-center justify-center px-4 py-8">
        <section class="w-full max-w-md rounded-lg bg-card p-6 sm:p-8" aria-labelledby="first-password-title">
            <div class="mb-6 flex items-center gap-2 font-semibold">
                <Box class="size-6 text-primary" aria-hidden="true" />
                璇玑云库
            </div>
            <h1 id="first-password-title" class="text-xl font-semibold">设置本地密码</h1>
            <PasswordForm class="mt-6" :pending="pending" :error="error" label="保存密码" @submit="submit" />
            <Button as-child variant="link" class="mt-5 w-full">
                <RouterLink to="/main/management/account-setting">返回账户设置</RouterLink>
            </Button>
        </section>
    </main>
</template>
