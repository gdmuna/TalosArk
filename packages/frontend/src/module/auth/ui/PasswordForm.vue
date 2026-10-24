<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue';
import { Eye, EyeOff, KeyRound, LoaderCircle } from '@lucide/vue';
import { LocalPasswordBounds, LocalPasswordSchema } from '@talos-ark/contracts/auth';
import { Button } from '@/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

const props = withDefaults(defineProps<{ pending: boolean; error: string; label: string; passwordLabel?: string }>(), {
    passwordLabel: '密码',
});
const emit = defineEmits<{ submit: [password: string] }>();
const id = useId();
const form = useTemplateRef<HTMLFormElement>('form');
const password = ref('');
const confirmation = ref('');
const visible = ref(false);
const passwordError = ref('');
const confirmationError = ref('');
watch(password, () => {
    passwordError.value = '';
});
watch(confirmation, () => {
    confirmationError.value = '';
});
onBeforeUnmount(() => {
    password.value = confirmation.value = '';
});

async function submit() {
    if (props.pending) return;
    passwordError.value = confirmationError.value = '';
    const result = LocalPasswordSchema.safeParse(password.value);
    if (!result.success)
        passwordError.value = `密码需为 ${LocalPasswordBounds.minCodePoints}–${LocalPasswordBounds.maxCodePoints} 个字符。`;
    if (password.value !== confirmation.value) confirmationError.value = '两次输入的密码不一致。';
    if (!result.success || confirmationError.value) {
        await nextTick();
        form.value?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
        return;
    }
    emit('submit', result.data);
}
</script>

<template>
    <form ref="form" class="space-y-5" :aria-busy="pending" @submit.prevent="submit">
        <FieldGroup>
            <Field :data-invalid="!!passwordError">
                <FieldLabel :for="`${id}-password`">{{ passwordLabel }}</FieldLabel>
                <div class="relative">
                    <Input
                        :id="`${id}-password`"
                        v-model="password"
                        :type="visible ? 'text' : 'password'"
                        name="new-password"
                        autocomplete="new-password"
                        maxlength="256"
                        required
                        :disabled="pending"
                        :aria-invalid="!!passwordError"
                        :aria-describedby="`${id}-hint${passwordError ? ` ${id}-password-error` : ''}`"
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
                        <EyeOff v-if="visible" class="size-4" aria-hidden="true" />
                        <Eye v-else class="size-4" aria-hidden="true" />
                    </Button>
                </div>
                <FieldDescription :id="`${id}-hint`">
                    {{ LocalPasswordBounds.minCodePoints }}–{{ LocalPasswordBounds.maxCodePoints }} 个字符，空格会保留。
                </FieldDescription>
                <FieldError v-if="passwordError" :id="`${id}-password-error`">{{ passwordError }}</FieldError>
            </Field>
            <Field :data-invalid="!!confirmationError">
                <FieldLabel :for="`${id}-confirm`">再次输入{{ passwordLabel }}</FieldLabel>
                <Input
                    :id="`${id}-confirm`"
                    v-model="confirmation"
                    :type="visible ? 'text' : 'password'"
                    name="new-password-confirm"
                    autocomplete="new-password"
                    maxlength="256"
                    required
                    :disabled="pending"
                    :aria-invalid="!!confirmationError"
                    :aria-describedby="confirmationError ? `${id}-confirm-error` : undefined"
                />
                <FieldError v-if="confirmationError" :id="`${id}-confirm-error`">{{ confirmationError }}</FieldError>
            </Field>
        </FieldGroup>
        <FieldError v-if="error">{{ error }}</FieldError>
        <Button type="submit" class="w-full" :disabled="pending">
            <LoaderCircle v-if="pending" class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <KeyRound v-else class="size-4" aria-hidden="true" />
            {{ pending ? '正在提交' : label }}
        </Button>
    </form>
</template>
