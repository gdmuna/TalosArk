<template>
    <form class="space-y-5" @submit.prevent>
        <FieldGroup>
            <Field>
                <FieldLabel for="auth-email">工作邮箱</FieldLabel>
                <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    autocomplete="email"
                    placeholder="name@organization.com"
                />
            </Field>

            <Field>
                <FieldLabel for="auth-email-code">邮箱验证码</FieldLabel>
                <div class="flex min-w-0 gap-2">
                    <Input
                        id="auth-email-code"
                        name="email-code"
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
