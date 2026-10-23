<template>
    <AuthPage title="登录到璇玑云库">
        <p v-if="api.state.value.notice" role="status" class="mb-5 text-sm leading-6 text-muted-foreground">
            {{ api.state.value.notice }}
        </p>
        <div class="rounded-lg bg-muted p-1 flex gap-1" role="group" aria-label="选择登录方式">
            <Button
                v-for="method in loginMethods"
                :key="method.value"
                type="button"
                variant="ghost"
                size="sm"
                class="w-1/3 px-2 text-muted-foreground data-[active=true]:bg-card data-[active=true]:text-foreground data-[active=true]:shadow-xs shrink"
                :data-active="activeMethod === method.value"
                :aria-pressed="activeMethod === method.value"
                :disabled="method.value !== 'account'"
                @click="activeMethod = method.value"
            >
                <component :is="method.icon" class="size-4" aria-hidden="true" />
                <span>{{ method.label }}</span>
            </Button>
        </div>

        <div class="mt-6">
            <AuthAccountLogin v-if="activeMethod === 'account'" v-model:pending="loginPending" />
            <AuthEmailLogin v-else-if="activeMethod === 'email'" />
            <AuthPhoneNumLogin v-else />
        </div>

        <FieldSeparator class="my-6">或使用第三方登录</FieldSeparator>

        <div class="grid grid-cols-3 gap-2">
            <Button
                type="button"
                variant="outline"
                class="h-10 min-w-0 px-2 font-normal"
                :disabled="loginPending"
                @click="handleCasdoorLogin"
            >
                <Building2 class="size-4" aria-hidden="true" />
                <span>企业 SSO</span>
            </Button>
            <Button type="button" variant="outline" class="h-10 min-w-0 px-2 font-normal" disabled>
                <MessageCircle class="size-4" aria-hidden="true" />
                <span>微信</span>
            </Button>
            <Button type="button" variant="outline" class="h-10 min-w-0 px-2 font-normal" disabled>
                <Globe2 class="size-4" aria-hidden="true" />
                <span>Google</span>
            </Button>
        </div>

        <p v-if="loginError" role="alert" class="mt-3 text-sm text-destructive">{{ loginError }}</p>

        <p class="mt-6 text-center text-xs leading-5 text-muted-foreground">
            登录即表示你同意璇玑云库的服务条款与隐私政策。
        </p>
    </AuthPage>
</template>

<script setup lang="ts">
import { Building2, Globe2, KeyRound, Mail, MessageCircle, Smartphone } from '@lucide/vue';
import { onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import AuthAccountLogin from './Auth-AccountLogin.vue';
import AuthEmailLogin from './Auth-EmailLogin.vue';
import AuthPhoneNumLogin from './Auth-PhoneNumLogin.vue';
import { Button } from '@/ui/button';
import { FieldSeparator } from '@/ui/field';

import { authErrorMessage, rememberOidcReturn, useAuthApi } from '@/module/auth';
import { AuthPage } from '@/module/auth/ui';

type LoginMethod = 'account' | 'email' | 'phone';

const activeMethod = ref<LoginMethod>('account');
const api = useAuthApi();
const route = useRoute();
const loginPending = ref(false);
const loginError = ref('');
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());

const loginMethods = [
    { value: 'account', label: '账号密码', icon: KeyRound },
    { value: 'email', label: '邮箱登录', icon: Mail },
    { value: 'phone', label: '手机登录', icon: Smartphone },
] as const;

async function handleCasdoorLogin() {
    if (loginPending.value) return;
    loginPending.value = true;
    loginError.value = '';
    try {
        const res = await api.startOidcLogin({ signal: controller.signal });
        if (controller.signal.aborted) return;
        rememberOidcReturn(res.url, route.query.next);
        window.location.href = res.url;
    } catch (error) {
        if (!controller.signal.aborted)
            loginError.value = authErrorMessage(error, '暂时无法开始企业 SSO 登录，请稍后重试。');
    } finally {
        loginPending.value = false;
    }
}
</script>
