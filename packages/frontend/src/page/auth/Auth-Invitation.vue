<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Mail } from '@lucide/vue';
import { useAuthApi } from '@/module/auth';
import {
    useTeamStore,
    useWorkspaceStore,
    captureInvitation,
    pendingInvitation,
    clearInvitation,
    teamErrorMessage,
} from '@/module/workspace';
import { Button } from '@/ui/button';

const route = useRoute(),
    router = useRouter(),
    auth = useAuthApi(),
    team = useTeamStore(),
    workspace = useWorkspaceStore();
const preview = ref<Awaited<ReturnType<typeof team.inspect>> | null>(null);
const pending = ref(false),
    completed = ref(false),
    error = ref(''),
    token = ref(pendingInvitation());
let controller: AbortController | undefined;
let revision = 0;
let inspectedToken = '';
watch(
    () => route.hash,
    (hash) => {
        if (!hash) return;
        const tokens = new URLSearchParams(hash.slice(1)).getAll('token');
        captureInvitation(tokens.length === 1 ? tokens[0] : '');
        token.value = pendingInvitation();
        void router.replace({ path: route.path, query: {}, hash: '' });
    },
    { immediate: true }
);
watch(
    [token, () => auth.state.value.version],
    async () => {
        const current = ++revision;
        controller?.abort();
        controller = new AbortController();
        const signal = controller.signal;
        preview.value = null;
        inspectedToken = '';
        completed.value = pending.value = false;
        error.value = '';
        const value = token.value;
        if (!value) {
            error.value = '邀请链接无效，请重新打开邮件中的链接';
            return;
        }
        pending.value = true;
        try {
            if (['unknown', 'restoring'].includes(auth.state.value.status)) await auth.restore(signal);
            if (current !== revision || auth.state.value.status !== 'authenticated') return;
            const result = await team.inspect(value, signal);
            if (current === revision && !signal.aborted) {
                preview.value = result;
                inspectedToken = value;
            }
        } catch (cause) {
            if (current === revision && !signal.aborted) error.value = teamErrorMessage(cause);
        } finally {
            if (current === revision) pending.value = false;
        }
    },
    { immediate: true }
);

async function accept() {
    if (pending.value || !preview.value || !inspectedToken || auth.state.value.status !== 'authenticated') return;
    const value = inspectedToken;
    const current = ++revision;
    controller?.abort();
    controller = new AbortController();
    pending.value = true;
    error.value = '';
    try {
        await team.accept(value, controller.signal);
        if (current !== revision) return;
        clearInvitation();
        completed.value = true;
        try {
            await workspace.load(controller.signal);
        } catch {
            error.value = '已加入，工作区列表尚未同步，可进入管理中心后重新加载';
        }
    } catch (cause) {
        if (current === revision && !controller.signal.aborted) error.value = teamErrorMessage(cause);
    } finally {
        if (current === revision) pending.value = false;
    }
}
onBeforeUnmount(() => {
    revision++;
    controller?.abort();
});
</script>

<template>
    <main class="flex min-h-full w-full items-center justify-center p-6">
        <section class="w-full max-w-md space-y-5 rounded-lg bg-card p-8">
            <div class="flex items-center gap-2 font-semibold">
                <Mail class="size-5 text-primary" />
                璇玑云库
            </div>
            <h1 class="text-xl font-semibold">{{ completed ? '已加入组织' : '组织邀请' }}</h1>
            <div v-if="preview && !completed" class="space-y-2 text-sm">
                <p>
                    {{ preview.organizationName }}
                    <span v-if="preview.workspaceName">· {{ preview.workspaceName }}</span>
                </p>
                <p class="text-muted-foreground">{{ preview.email }}</p>
            </div>
            <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
            <p v-if="pending" role="status" class="text-sm text-muted-foreground">正在处理</p>
            <Button v-if="completed" as-child class="w-full">
                <RouterLink to="/main/management/member">进入管理中心</RouterLink>
            </Button>
            <Button v-else-if="preview" class="w-full" :disabled="pending" @click="accept">接受邀请</Button>
            <Button
                v-else-if="token && !pending && auth.state.value.status !== 'authenticated'"
                as-child
                class="w-full"
            >
                <RouterLink :to="{ path: '/auth/login', query: { next: '/auth/invitation' } }">
                    登录后接受邀请
                </RouterLink>
            </Button>
        </section>
    </main>
</template>
