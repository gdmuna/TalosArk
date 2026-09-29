<template>
    <form class="space-y-5" @submit.prevent>
        <FieldGroup>
            <Field>
                <FieldLabel for="auth-account">账号或工作邮箱</FieldLabel>
                <Input id="auth-account" name="account" autocomplete="username" placeholder="输入账号或工作邮箱" />
            </Field>

            <Field>
                <div class="flex items-center justify-between gap-3">
                    <FieldLabel for="auth-password">密码</FieldLabel>
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        class="h-auto px-0 text-xs font-normal cursor-pointer"
                    >
                        忘记密码？
                    </Button>
                </div>
                <Input
                    id="auth-password"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    placeholder="输入密码"
                />
            </Field>
        </FieldGroup>

        <Button type="submit" class="w-full">登录</Button>
    </form>
</template>

<script setup lang="ts">
import { Button } from '@/ui/button';
import { Field, FieldGroup, FieldLabel, FieldSet } from '@/ui/field';
import { Input } from '@/ui/input';
</script>
