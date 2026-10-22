<template>
    <main class="flex min-h-full w-full items-center justify-center px-4 py-8">
        <section class="w-full max-w-md rounded-lg bg-card p-6 sm:p-8" aria-labelledby="recovery-title">
            <div class="mb-6 flex items-center gap-2 font-semibold">
                <Box class="size-6 text-primary" aria-hidden="true" />
                璇玑云库
            </div>
            <h1 id="recovery-title" class="text-xl font-semibold">找回密码</h1>
            <p class="mt-2 text-sm text-muted-foreground">使用账户邮箱申请重设密码。</p>
            <form class="mt-6 space-y-5" @submit.prevent="submit">
                <Field>
                    <FieldLabel for="recovery-email">账户邮箱</FieldLabel>
                    <Input
                        id="recovery-email"
                        v-model="email"
                        type="email"
                        name="email"
                        autocomplete="email"
                        maxlength="254"
                        required
                        :disabled="pending"
                        placeholder="输入账户邮箱"
                    />
                </Field>
                <p v-if="accepted" role="status" class="text-sm leading-6 text-foreground">
                    申请已受理。如该邮箱对应可恢复的账户，系统将尝试发送重设密码邮件。未收到时可检查垃圾邮件或稍后重新申请。
                </p>
                <FieldError v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</FieldError>
                <Button type="submit" class="w-full" :disabled="pending || remaining > 0">
                    <LoaderCircle v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
                    <Mail v-else class="size-4" aria-hidden="true" />
                    {{
                        pending
                            ? '正在申请'
                            : remaining > 0
                              ? `${remaining} 秒后可重新申请`
                              : accepted
                                ? '重新申请'
                                : '申请重设密码'
                    }}
                </Button>
            </form>
            <Button as-child variant="link" class="mt-5 h-auto px-0 font-normal">
                <RouterLink to="/auth/login">
                    <ArrowLeft class="size-4" aria-hidden="true" />
                    返回登录
                </RouterLink>
            </Button>
        </section>
    </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useTimestamp } from '@vueuse/core';
import { ArrowLeft, Box, LoaderCircle, Mail } from '@lucide/vue';
import { PasswordRecoveryRequestBodySchema } from '@talos-ark/contracts/auth';
import { useAuthApi } from '@/module/auth';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { Button } from '@/ui/button';
import { Field, FieldError, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

const api = useAuthApi();
const email = ref('');
const pending = ref(false);
const accepted = ref(false);
const error = ref('');
const nextAllowedAt = ref(0);
const now = useTimestamp({ interval: 1000 });
const remaining = computed(() => Math.max(0, Math.ceil((nextAllowedAt.value - now.value) / 1000)));
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());

async function submit() {
    if (pending.value || remaining.value) return;
    error.value = '';
    const body = PasswordRecoveryRequestBodySchema.safeParse({ email: email.value });
    if (!body.success) {
        error.value = '请输入有效的账户邮箱。';
        return;
    }
    pending.value = true;
    try {
        const result = await api.requestPasswordRecovery(body.data, { signal: controller.signal });
        accepted.value = true;
        nextAllowedAt.value = Date.now() + result.retryAfterSeconds * 1000;
    } catch (cause) {
        if (controller.signal.aborted) return;
        if (isResponseValidationError(cause)) return;
        if (cause instanceof HttpError && cause.status === 429) {
            error.value = '申请过于频繁，请稍后再试。';
            nextAllowedAt.value = Date.now() + (cause.retryAfterMs ?? 60_000);
        } else error.value = '暂时无法受理申请，请稍后重试。';
    } finally {
        pending.value = false;
    }
}
</script>
