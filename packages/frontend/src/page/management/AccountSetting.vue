<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAccountStore } from '@/module/account';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementViewNav from './component/ManagementViewNav.vue';
import PersonalNotificationSetting from './component/PersonalNotificationSetting.vue';
import { useManagementView } from './useManagementView';

const account = useAccountStore();
const views = [
    { value: 'profile', label: '个人资料' },
    { value: 'notification', label: '通知设置' },
];
const view = useManagementView(views);
const displayName = ref('');
const error = ref('');
const saved = ref(false);
const initial = computed(() => account.profile?.displayName.slice(0, 1).toUpperCase() ?? '');
const dirty = computed(() => displayName.value !== (account.profile?.displayName ?? ''));
watch(() => account.profile?.displayName, reset, { immediate: true });
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
    error.value = await account.updateDisplayName(displayName.value);
    saved.value = !error.value;
}
</script>

<template>
    <ManagementPage title="账户设置" layout="form" :context="account.profile?.email ?? '当前账户'">
        <template #navigation>
            <ManagementViewNav v-model="view" :items="views" label="账户设置视图" />
        </template>
        <form v-if="view === 'profile'" class="space-y-6" @submit.prevent="save">
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
                <div class="space-y-2">
                    <Label for="account-display-name">显示名称</Label>
                    <Input
                        id="account-display-name"
                        v-model="displayName"
                        required
                        maxlength="40"
                        autocomplete="nickname"
                        :disabled="
                            !account.profile || account.busy || !!account.syncError || !account.canUpdateDisplayName
                        "
                    />
                </div>
                <div class="space-y-2">
                    <Label for="account-email">邮箱</Label>
                    <Input
                        id="account-email"
                        :model-value="account.profile?.email"
                        type="email"
                        readonly
                        class="bg-muted text-muted-foreground"
                    />
                </div>
            </ManagementSection>
            <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
            <p v-if="saved" role="status" class="text-sm text-success">资料已保存</p>
            <div class="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" :disabled="!dirty || account.busy" @click="reset">
                    取消更改
                </Button>
                <Button
                    type="submit"
                    :disabled="
                        !dirty ||
                        account.busy ||
                        !!account.syncError ||
                        !account.profile ||
                        !account.canUpdateDisplayName
                    "
                >
                    保存资料
                </Button>
            </div>
            <ManagementSection title="登录安全">
                <Button as-child variant="outline">
                    <RouterLink to="/auth/set-password">设置本地密码</RouterLink>
                </Button>
            </ManagementSection>
        </form>
        <PersonalNotificationSetting v-else />
    </ManagementPage>
</template>
