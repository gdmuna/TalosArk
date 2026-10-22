<template>
    <form class="space-y-5" @submit.prevent="submit">
        <FieldGroup>
            <Field>
                <FieldLabel for="auth-account">账号或工作邮箱</FieldLabel>
                <Input
                    id="auth-account"
                    v-model="identifier"
                    name="account"
                    autocomplete="username"
                    placeholder="输入账号或工作邮箱"
                    maxlength="254"
                    required
                    :disabled="pending"
                />
            </Field>

            <Field>
                <div class="flex items-center justify-between gap-3">
                    <FieldLabel for="auth-password">密码</FieldLabel>
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        class="h-auto px-0 text-xs font-normal cursor-pointer"
                        as-child
                    >
                        <RouterLink to="/auth/recovery">忘记密码？</RouterLink>
                    </Button>
                </div>
                <Input
                    id="auth-password"
                    v-model="password"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    placeholder="输入密码"
                    maxlength="256"
                    required
                    :disabled="pending"
                />
            </Field>
        </FieldGroup>

        <FieldError v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</FieldError>
        <Button type="submit" class="w-full" :disabled="pending">
            <LoaderCircle v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
            {{ pending ? '正在登录' : '登录' }}
        </Button>
    </form>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LoaderCircle } from '@lucide/vue';
import { PasswordLoginBodySchema } from '@talos-ark/contracts/auth';
import { authErrorMessage, useAuthApi } from '@/module/auth';
import { Button } from '@/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

const api = useAuthApi();
const router = useRouter();
const route = useRoute();
const identifier = ref('');
const password = ref('');
const error = ref('');
const pending = ref(false);
const controller = new AbortController();
onBeforeUnmount(() => {
    controller.abort();
    password.value = '';
});

async function submit() {
    if (pending.value) return;
    const body = PasswordLoginBodySchema.safeParse({ identifier: identifier.value, password: password.value });
    if (!body.success) {
        error.value = '请输入有效的账号和密码。';
        return;
    }
    pending.value = true;
    error.value = '';
    try {
        await api.passwordLogin(body.data, { signal: controller.signal });
        password.value = '';
        const next = route.query.next;
        const destination =
            typeof next === 'string' &&
            !next.includes('\\') &&
            (/^\/main(?:\/|\?|$)/.test(next) || next === '/auth/set-password' || next === '/auth/invitation')
                ? next
                : '/main';
        await router.replace(destination);
    } catch (cause) {
        if (!controller.signal.aborted) error.value = authErrorMessage(cause, '暂时无法登录，请稍后重试。');
    } finally {
        pending.value = false;
    }
}
</script>
