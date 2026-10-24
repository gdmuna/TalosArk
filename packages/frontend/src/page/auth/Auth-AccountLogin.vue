<template>
    <form class="space-y-5" :aria-busy="pending" @submit.prevent="submit">
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
                    :aria-describedby="error ? 'login-error' : undefined"
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
                        <RouterLink :to="{ path: '/auth/recovery', query: { next: authReturnPath(route.query.next) } }">
                            忘记密码？
                        </RouterLink>
                    </Button>
                </div>
                <div class="relative">
                    <Input
                        id="auth-password"
                        v-model="password"
                        name="password"
                        :type="visible ? 'text' : 'password'"
                        autocomplete="current-password"
                        placeholder="输入密码"
                        maxlength="256"
                        required
                        :disabled="pending"
                        :aria-describedby="error ? 'login-error' : undefined"
                        class="pr-10"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        class="absolute right-1 top-1/2 -translate-y-1/2"
                        :aria-label="visible ? '隐藏密码' : '显示密码'"
                        :aria-pressed="visible"
                        use-tooltip
                        :tooltip="visible ? '隐藏密码' : '显示密码'"
                        @click="visible = !visible"
                    >
                        <EyeOff v-if="visible" class="size-4" aria-hidden="true" />
                        <Eye v-else class="size-4" aria-hidden="true" />
                    </Button>
                </div>
            </Field>
        </FieldGroup>

        <FieldError v-if="error" id="login-error">{{ error }}</FieldError>
        <Button type="submit" class="w-full" :disabled="pending">
            <LoaderCircle v-if="pending" class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {{ pending ? '正在登录' : '登录' }}
        </Button>
    </form>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Eye, EyeOff, LoaderCircle } from '@lucide/vue';
import { PasswordLoginBodySchema } from '@talos-ark/contracts/auth';
import { authErrorMessage, authReturnPath, useAuthApi } from '@/module/auth';
import { Button } from '@/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

const api = useAuthApi();
const router = useRouter();
const route = useRoute();
const identifier = ref('');
const password = ref('');
const error = ref('');
const pending = defineModel<boolean>('pending', { default: false });
const visible = ref(false);
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
        if (controller.signal.aborted) return;
        password.value = '';
        await router.replace(authReturnPath(route.query.next));
    } catch (cause) {
        if (!controller.signal.aborted) error.value = authErrorMessage(cause, '暂时无法登录，请稍后重试。');
    } finally {
        pending.value = false;
    }
}
</script>
