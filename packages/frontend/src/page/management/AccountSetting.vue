<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { useAccountStore } from '@/module/account';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { DataSyncNotice } from '@/component/data-sync';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import PersonalNotificationSetting from './component/PersonalNotificationSetting.vue';
import { useManagementView } from './useManagementView';
import { Field, FieldError, FieldLabel } from '@/ui/field';
import { CopyableId } from '@/component/inspector';
import { useDraftGuard } from './detail/useDraftGuard';
import DraftDialog from './detail/DraftDialog.vue';
import { useEventListener } from '@vueuse/core';

const account = useAccountStore();
const formId = useId();
const views = [
    { value: 'profile', label: '个人资料' },
    { value: 'notification', label: '通知设置' },
];
const view = useManagementView(views);
const displayName = ref('');
const error = ref('');
const saved = ref(false);
const initial = computed(() => account.profile?.displayName.slice(0, 1).toUpperCase() ?? '');
const dirty = computed(
    () =>
        account.canUpdateDisplayName &&
        !account.syncPending &&
        !!account.profile &&
        displayName.value !== account.profile.displayName
);
const guard = useDraftGuard(dirty, reset);
watch(() => [account.profile?.id, account.profile?.displayName], reset, { immediate: true });
useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
    if (!dirty.value) return;
    event.preventDefault();
    event.returnValue = '';
});
watch(displayName, () => {
    saved.value = false;
    error.value = '';
});
provideBreadcrumbs(() => [
    { id: 'management', label: '管理中心', to: '/main/management/overview' },
    { id: 'account', label: '账户设置' },
    { id: 'account-view', label: views.find((item) => item.value === view.value)?.label ?? views[0].label },
]);
function reset() {
    displayName.value = account.profile?.displayName ?? '';
    error.value = '';
    saved.value = false;
}
async function save() {
    if (!dirty.value || account.busy || account.syncPending) return;
    const owner = account.profile?.id;
    const result = await account.updateDisplayName(displayName.value);
    if (owner !== account.profile?.id) return;
    error.value = account.syncPending ? '' : (result ?? '');
    saved.value = result === '' && !account.syncPending;
}
</script>

<template>
    <ManagementPage title="账户设置" layout="form" :context="account.profile?.email ?? '当前账户'">
        <template #navigation>
            <ManagementViewNav v-model="view" :items="views" label="账户设置视图" />
        </template>
        <div v-if="view === 'profile'" class="space-y-6">
            <ManagementSection title="个人资料">
                <div class="flex items-center gap-4 pb-2">
                    <span
                        class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-medium text-primary-soft-foreground"
                        aria-hidden="true"
                    >
                        {{ initial }}
                    </span>
                    <span class="min-w-0 break-words font-medium">{{ account.profile?.displayName }}</span>
                </div>
                <form v-if="account.canUpdateDisplayName" :id="formId" class="space-y-5" @submit.prevent="save">
                    <Field>
                        <FieldLabel for="account-display-name">显示名称</FieldLabel>
                        <Input
                            id="account-display-name"
                            v-model="displayName"
                            required
                            maxlength="40"
                            autocomplete="nickname"
                            :disabled="!account.profile || account.busy || account.syncPending"
                        />
                    </Field>
                </form>
                <dl v-else class="text-sm">
                    <div class="grid grid-cols-[6rem_minmax(0,1fr)] gap-4">
                        <dt class="text-muted-foreground">显示名称</dt>
                        <dd class="break-words">{{ account.profile?.displayName }}</dd>
                    </div>
                </dl>
                <dl class="space-y-4 text-sm">
                    <div class="grid grid-cols-[6rem_minmax(0,1fr)] gap-4">
                        <dt class="text-muted-foreground">账号</dt>
                        <dd class="break-words">{{ account.profile?.username }}</dd>
                    </div>
                    <div class="grid grid-cols-[6rem_minmax(0,1fr)] gap-4">
                        <dt class="text-muted-foreground">邮箱</dt>
                        <dd class="break-all">{{ account.profile?.email }}</dd>
                    </div>
                    <div v-if="account.profile" class="grid grid-cols-[6rem_minmax(0,1fr)] gap-4">
                        <dt class="text-muted-foreground">账户 ID</dt>
                        <dd class="min-w-0"><CopyableId :value="account.profile.id" label="账户 ID" /></dd>
                    </div>
                </dl>
                <FieldError v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</FieldError>
                <p v-if="saved" role="status" class="text-sm text-success">资料已保存</p>
                <DataSyncNotice
                    v-if="account.syncPending && !account.syncError"
                    scope="账户资料"
                    :error="account.syncError"
                    :pending="account.syncPending"
                    :busy="account.busy"
                    @retry="account.retrySync()"
                />
                <div v-if="account.canUpdateDisplayName" class="flex justify-end gap-2 border-t pt-4">
                    <Button type="button" variant="outline" :disabled="!dirty || account.busy" @click="reset">
                        取消更改
                    </Button>
                    <Button
                        type="submit"
                        :form="formId"
                        :disabled="
                            !dirty ||
                            account.busy ||
                            account.syncPending ||
                            !account.profile ||
                            !account.canUpdateDisplayName
                        "
                    >
                        保存资料
                    </Button>
                </div>
            </ManagementSection>
            <ManagementSection title="登录安全">
                <Button as-child variant="outline">
                    <RouterLink to="/auth/set-password">设置本地密码</RouterLink>
                </Button>
            </ManagementSection>
        </div>
        <PersonalNotificationSetting v-else />
    </ManagementPage>
    <DraftDialog :open="guard.open.value" @decide="guard.decide" />
</template>
