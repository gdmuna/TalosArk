<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { Eye, EyeOff, KeyRound, LoaderCircle } from '@lucide/vue';
import { LocalPasswordBounds, LocalPasswordSchema } from '@talos-ark/contracts/auth';
import { Button } from '@/ui/button';
import { Field, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

defineProps<{ pending: boolean; error: string; label: string }>();
const emit = defineEmits<{ submit: [password: string] }>();
const password = ref('');
const confirmation = ref('');
const visible = ref(false);
const validationError = ref('');
onBeforeUnmount(() => {
    password.value = confirmation.value = '';
});

function submit() {
    validationError.value = '';
    if (password.value !== confirmation.value) {
        validationError.value = '两次输入的密码不一致。';
        return;
    }
    const result = LocalPasswordSchema.safeParse(password.value);
    if (!result.success) {
        validationError.value = `密码需为 ${LocalPasswordBounds.minCodePoints}–${LocalPasswordBounds.maxCodePoints} 个字符。`;
        return;
    }
    emit('submit', result.data);
}
</script>

<template>
    <form class="space-y-5" @submit.prevent="submit">
        <Field>
            <FieldLabel for="setup-password">密码</FieldLabel>
            <div class="relative">
                <Input
                    id="setup-password"
                    v-model="password"
                    :type="visible ? 'text' : 'password'"
                    name="new-password"
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
                    use-tooltip
                    :tooltip="visible ? '隐藏密码' : '显示密码'"
                    :aria-label="visible ? '隐藏密码' : '显示密码'"
                    :aria-pressed="visible"
                    class="absolute right-1 top-1/2 -translate-y-1/2"
                    @click="visible = !visible"
                >
                    <EyeOff v-if="visible" class="size-4" />
                    <Eye v-else class="size-4" />
                </Button>
            </div>
            <p class="text-xs text-muted-foreground">
                {{ LocalPasswordBounds.minCodePoints }}–{{ LocalPasswordBounds.maxCodePoints }} 个字符，空格会保留。
            </p>
        </Field>
        <Field>
            <FieldLabel for="setup-password-confirm">再次输入密码</FieldLabel>
            <Input
                id="setup-password-confirm"
                v-model="confirmation"
                :type="visible ? 'text' : 'password'"
                name="new-password-confirm"
                autocomplete="new-password"
                maxlength="256"
                required
                :disabled="pending"
            />
        </Field>
        <p v-if="validationError || error" role="alert" class="text-sm text-destructive">
            {{ validationError || error }}
        </p>
        <Button type="submit" class="w-full" :disabled="pending">
            <LoaderCircle v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
            <KeyRound v-else class="size-4" aria-hidden="true" />
            {{ pending ? '正在提交' : label }}
        </Button>
    </form>
</template>
