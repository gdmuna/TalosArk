<template>
    <main class="flex min-h-full w-full items-center justify-center bg-card px-4 sm:p-8">
        <section class="w-full max-w-md rounded-xl p-6 sm:p-8" aria-labelledby="auth-title">
            <header class="flex flex-col items-center text-center">
                <h1 id="auth-title" class="mt-5 text-xl font-semibold tracking-tight">登录璇玑云库</h1>
            </header>

            <div class="mt-7 rounded-lg bg-muted p-1" role="group" aria-label="选择登录方式">
                <Button
                    v-for="method in loginMethods"
                    :key="method.value"
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="w-1/3 px-2 text-muted-foreground data-[active=true]:bg-card data-[active=true]:text-foreground data-[active=true]:shadow-xs"
                    :data-active="activeMethod === method.value"
                    :aria-pressed="activeMethod === method.value"
                    @click="activeMethod = method.value"
                >
                    <component :is="method.icon" class="size-4" stroke-width="1.75" aria-hidden="true" />
                    <span>{{ method.label }}</span>
                </Button>
            </div>

            <div class="mt-6">
                <AuthAccountLogin v-if="activeMethod === 'account'" />
                <AuthEmailLogin v-else-if="activeMethod === 'email'" />
                <AuthPhoneNumLogin v-else />
            </div>

            <FieldSeparator class="my-6">或使用第三方登录</FieldSeparator>

            <div class="grid grid-cols-3 gap-2">
                <Button
                    type="button"
                    variant="outline"
                    class="h-10 min-w-0 px-2 font-normal"
                    @click="handleCasdoorLogin"
                >
                    <Building2 class="size-4" stroke-width="1.75" aria-hidden="true" />
                    <span>企业 SSO</span>
                </Button>
                <Button type="button" variant="outline" class="h-10 min-w-0 px-2 font-normal">
                    <MessageCircle class="size-4" stroke-width="1.75" aria-hidden="true" />
                    <span>微信</span>
                </Button>
                <Button type="button" variant="outline" class="h-10 min-w-0 px-2 font-normal">
                    <Globe2 class="size-4" stroke-width="1.75" aria-hidden="true" />
                    <span>Google</span>
                </Button>
            </div>

            <p class="mt-6 text-center text-xs leading-5 text-muted-foreground">
                登录即表示你同意璇玑云库的服务条款与隐私政策。
            </p>
        </section>
    </main>
</template>

<script setup lang="ts">
import { Building2, Globe2, KeyRound, Mail, MessageCircle, Smartphone } from '@lucide/vue';
import { ref } from 'vue';
import AuthAccountLogin from './Auth-AccountLogin.vue';
import AuthEmailLogin from './Auth-EmailLogin.vue';
import AuthPhoneNumLogin from './Auth-PhoneNumLogin.vue';
import { Button } from '@/ui/button';
import { FieldSeparator } from '@/ui/field';

import { axiosInstance } from '@/shared/api/client.js';

type LoginMethod = 'account' | 'email' | 'phone';

const activeMethod = ref<LoginMethod>('account');

const loginMethods = [
    { value: 'account', label: '账号密码', icon: KeyRound },
    { value: 'email', label: '邮箱登录', icon: Mail },
    { value: 'phone', label: '手机登录', icon: Smartphone },
] as const;

async function handleCasdoorLogin() {
    const res = await axiosInstance.post<any, { url: string }>('http://localhost:3000/api/v1/auth/oidc/start');
    console.log(res);
    window.location.href = res.url;
}
</script>
