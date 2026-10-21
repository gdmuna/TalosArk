<template>
    <main class="flex min-h-full w-full items-center justify-center px-4 py-8">
        <section class="w-full max-w-md rounded-lg bg-card p-6 sm:p-8" aria-labelledby="reset-title">
            <div class="mb-6 flex items-center gap-2 font-semibold">
                <Box class="size-6 text-primary" aria-hidden="true" />
                璇玑云库
            </div>
            <h1 id="reset-title" class="text-xl font-semibold">{{ completed ? '密码已重设' : '重设密码' }}</h1>
            <p v-if="completed" role="status" class="mt-3 text-sm leading-6 text-muted-foreground">
                原有登录会话已失效，请使用新密码重新登录。
            </p>
            <p v-else-if="!token" role="alert" class="mt-3 text-sm text-muted-foreground">
                该链接无效，请重新申请重设密码。
            </p>
            <form v-else class="mt-6 space-y-5" @submit.prevent="submit">
                <Field>
                    <FieldLabel for="reset-password">新密码</FieldLabel>
                    <div class="relative">
                        <Input
                            id="reset-password"
                            v-model="password"
                            name="new-password"
                            :type="visible ? 'text' : 'password'"
                            autocomplete="new-password"
                            maxlength="256"
                            required
                            :disabled="pending"
                            class="pr-10"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            class="absolute right-1 top-1/2 -translate-y-1/2"
                            :aria-label="visible ? '隐藏密码' : '显示密码'"
                            :tooltip="visible ? '隐藏密码' : '显示密码'"
                            use-tooltip
                            :aria-pressed="visible"
                            @click="visible = !visible"
                        >
                            <EyeOff v-if="visible" class="size-4" />
                            <Eye v-else class="size-4" />
                        </Button>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        {{ LocalPasswordBounds.minCodePoints }}–{{ LocalPasswordBounds.maxCodePoints }}
                        个字符，空格会保留。
                    </p>
                </Field>
                <Field>
                    <FieldLabel for="reset-password-confirm">再次输入新密码</FieldLabel>
                    <Input
                        id="reset-password-confirm"
                        v-model="confirmation"
                        name="new-password-confirm"
                        :type="visible ? 'text' : 'password'"
                        autocomplete="new-password"
                        maxlength="256"
                        required
                        :disabled="pending"
                    />
                </Field>
                <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
                <Button type="submit" class="w-full" :disabled="pending">
                    <LoaderCircle v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
                    <KeyRound v-else class="size-4" aria-hidden="true" />
                    {{ pending ? '正在重设' : '确认重设密码' }}
                </Button>
            </form>
            <Button v-if="!completed" as-child variant="link" class="mt-5 h-auto px-0 font-normal">
                <RouterLink to="/auth/recovery">重新申请</RouterLink>
            </Button>
            <Button as-child :variant="completed ? 'default' : 'link'" class="mt-5 w-full">
                <RouterLink to="/auth/login">
                    <ArrowLeft class="size-4" aria-hidden="true" />
                    返回登录
                </RouterLink>
            </Button>
        </section>
    </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Box, Eye, EyeOff, KeyRound, LoaderCircle } from '@lucide/vue';
import {
    PasswordRecoveryTokenSchema,
    PasswordRecoveryConfirmBodySchema,
    LocalPasswordBounds,
} from '@talos-ark/contracts/auth';
import { useAuthApi } from '@/module/auth';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { Button } from '@/ui/button';
import { Field, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

const route = useRoute();
const router = useRouter();
const api = useAuthApi();
const token = ref('');
const password = ref('');
const confirmation = ref('');
const visible = ref(false);
const pending = ref(false);
const completed = ref(false);
const error = ref('');
let revision = 0;
let controller: AbortController | undefined;

function readToken(hash: string): string {
    const values = new URLSearchParams(hash.slice(1)).getAll('token');
    if (values.length !== 1) return '';
    const parsed = PasswordRecoveryTokenSchema.safeParse(values[0]);
    return parsed.success ? parsed.data : '';
}

watch(
    () => route.hash,
    (hash) => {
        if (!hash) return;
        revision++;
        controller?.abort();
        token.value = readToken(hash);
        password.value = '';
        confirmation.value = '';
        pending.value = false;
        completed.value = false;
        error.value = '';
        // Consume the secret URL before making any request; keep it only in this page's memory.
        void router.replace({ path: route.path, query: route.query, hash: '' });
    },
    { immediate: true }
);

onBeforeUnmount(() => {
    revision++;
    controller?.abort();
    token.value = password.value = confirmation.value = '';
});

async function submit() {
    if (pending.value || !token.value) return;
    error.value = '';
    if (password.value !== confirmation.value) {
        error.value = '两次输入的密码不一致。';
        return;
    }
    const body = PasswordRecoveryConfirmBodySchema.safeParse({ token: token.value, password: password.value });
    if (!body.success) {
        error.value = `密码需为 ${LocalPasswordBounds.minCodePoints}–${LocalPasswordBounds.maxCodePoints} 个字符。`;
        return;
    }
    const current = ++revision;
    const request = new AbortController();
    controller = request;
    pending.value = true;
    try {
        await api.confirmPasswordRecovery(body.data, { signal: request.signal });
        if (current !== revision) return;
        completed.value = true;
        token.value = password.value = confirmation.value = '';
    } catch (cause) {
        if (current !== revision || request.signal.aborted) return;
        if (isResponseValidationError(cause)) return;
        if (cause instanceof HttpError && cause.code === 'AUTH_PASSWORD_RECOVERY_INVALID') {
            token.value = '';
            password.value = confirmation.value = '';
        } else if (cause instanceof HttpError && cause.code === 'AUTH_PASSWORD_REJECTED')
            error.value = '请换一个不易被猜到的密码。';
        else if (cause instanceof HttpError && cause.status === 429) error.value = '尝试过于频繁，请稍后再试。';
        else error.value = '暂时无法确认结果。可稍后重试；若链接已失效，请尝试使用新密码登录或重新申请。';
    } finally {
        if (current === revision) pending.value = false;
    }
}
</script>
