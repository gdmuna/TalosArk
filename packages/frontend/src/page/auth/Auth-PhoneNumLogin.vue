<template>
    <form class="space-y-5" @submit.prevent>
        <FieldGroup>
            <Field>
                <FieldLabel for="auth-phone">手机号</FieldLabel>
                <div class="flex h-9 min-w-0 items-center rounded-md border border-input bg-card shadow-xs">
                    <span class="shrink-0 border-r px-3 text-sm text-muted-foreground">+86</span>
                    <Input
                        id="auth-phone"
                        name="phone"
                        type="tel"
                        inputmode="tel"
                        autocomplete="tel"
                        placeholder="输入手机号"
                        class="h-full border-0 bg-transparent shadow-none focus-visible:border-transparent"
                    />
                </div>
            </Field>

            <Field>
                <FieldLabel for="auth-phone-code">短信验证码</FieldLabel>
                <div class="flex min-w-0 gap-2">
                    <Input
                        id="auth-phone-code"
                        name="phone-code"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        placeholder="输入验证码"
                    />
                    <Button type="button" variant="outline" class="shrink-0">获取验证码</Button>
                </div>
            </Field>
        </FieldGroup>

        <Button type="submit" class="w-full">登录</Button>
    </form>
</template>

<script setup lang="ts">
import { Button } from '@/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';
</script>
