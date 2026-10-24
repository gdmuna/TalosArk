<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthApi } from '@/module/auth';
import { AuthPage } from '@/module/auth/ui';
import { DataSyncNotice } from '@/component/data-sync';
import { isResponseValidationError } from '@/platform/http';
import {
    useTeamStore,
    useWorkspaceStore,
    captureInvitation,
    pendingInvitation,
    clearInvitation,
    teamErrorMessage,
} from '@/module/workspace';
import { Button } from '@/ui/button';
import { formatDateTime } from '@/shared/util/date-time';

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
const failed = ref(false);
const syncPending = ref(false);
const syncError = ref('');
const ready = ref(!route.hash);
let controller: AbortController | undefined;
let revision = 0;
let inspectedToken = '';
watch(
    () => route.hash,
    async (hash) => {
        if (!hash) return;
        const current = ++revision;
        controller?.abort();
        ready.value = false;
        preview.value = null;
        const tokens = new URLSearchParams(hash.slice(1)).getAll('token');
        captureInvitation(tokens.length === 1 ? tokens[0] : '');
        token.value = pendingInvitation();
        await router.replace({ path: route.path, query: route.query, hash: '' });
        if (current === revision) ready.value = true;
    },
    { immediate: true }
);
async function inspect() {
    const current = ++revision;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    preview.value = null;
    inspectedToken = '';
    completed.value = pending.value = false;
    failed.value = syncPending.value = false;
    syncError.value = '';
    error.value = '';
    const value = token.value;
    if (!value) {
        error.value = '邀请链接无效，请重新打开邮件中的链接';
        return;
    }
    pending.value = true;
    try {
        if (['unknown', 'restoring'].includes(auth.state.value.status)) await auth.restore(signal);
        if (current !== revision) return;
        if (auth.state.value.status !== 'authenticated') {
            if (auth.state.value.status === 'error') {
                failed.value = true;
                error.value = auth.state.value.error;
            }
            return;
        }
        const result = await team.inspect(value, signal);
        if (current === revision && !signal.aborted) {
            preview.value = result;
            inspectedToken = value;
        }
    } catch (cause) {
        if (current === revision && !signal.aborted) {
            failed.value = true;
            error.value = teamErrorMessage(cause);
        }
    } finally {
        if (current === revision) pending.value = false;
    }
}
watch(
    [token, () => auth.state.value.version, ready],
    () => {
        if (ready.value) void inspect();
    },
    { immediate: true }
);

async function retry() {
    if (pending.value) return;
    if (auth.state.value.status !== 'error') return inspect();
    pending.value = true;
    error.value = '';
    await auth.restore();
}

async function synchronize() {
    if (!controller || pending.value || !completed.value) return;
    const current = revision;
    const signal = controller.signal;
    pending.value = true;
    try {
        await workspace.load(signal);
        if (current !== revision || signal.aborted) return;
        syncPending.value = false;
        syncError.value = '';
    } catch (cause) {
        if (current !== revision || signal.aborted) return;
        syncPending.value = true;
        syncError.value = isResponseValidationError(cause) ? '' : '工作区列表尚未同步，请重新加载。';
    } finally {
        if (current === revision) pending.value = false;
    }
}

function switchAccount() {
    void auth.logout();
    void router.replace({ path: '/auth/login', query: { next: '/auth/invitation' } });
}

async function accept() {
    if (pending.value || !preview.value || !inspectedToken || auth.state.value.status !== 'authenticated') return;
    const value = inspectedToken;
    const current = ++revision;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    pending.value = true;
    error.value = '';
    try {
        await team.accept(value, request.signal);
        if (current !== revision || request.signal.aborted) return;
        clearInvitation();
        completed.value = true;
        pending.value = false;
        await synchronize();
    } catch (cause) {
        if (current === revision && !request.signal.aborted) error.value = teamErrorMessage(cause);
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
    <AuthPage :title="completed ? '已加入组织' : '组织邀请'">
        <div class="space-y-5">
            <dl v-if="preview && !completed" class="space-y-3 border-y py-4 text-sm">
                <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                    <dt class="text-muted-foreground">组织</dt>
                    <dd class="break-words">{{ preview.organizationName }}</dd>
                </div>
                <div v-if="preview.workspaceName" class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                    <dt class="text-muted-foreground">工作区</dt>
                    <dd class="break-words">{{ preview.workspaceName }}</dd>
                </div>
                <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                    <dt class="text-muted-foreground">受邀邮箱</dt>
                    <dd class="break-all">{{ preview.email }}</dd>
                </div>
                <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                    <dt class="text-muted-foreground">有效期至</dt>
                    <dd>
                        <time :datetime="preview.expiresAt">{{ formatDateTime(Date.parse(preview.expiresAt)) }}</time>
                    </dd>
                </div>
            </dl>
            <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
            <p v-if="pending" role="status" class="text-sm text-muted-foreground">
                {{ completed ? '正在同步工作区' : '正在处理邀请' }}
            </p>
            <DataSyncNotice
                v-if="completed"
                scope="工作区列表"
                :pending="syncPending"
                :error="syncError"
                :busy="pending"
                @retry="synchronize"
            />
            <Button v-if="completed" as-child class="w-full">
                <RouterLink to="/main/management/member">进入管理中心</RouterLink>
            </Button>
            <Button v-else-if="preview" class="w-full" :disabled="pending" @click="accept">接受邀请</Button>
            <Button v-else-if="failed" class="w-full" :disabled="pending" @click="retry">重新加载</Button>
            <Button v-else-if="token && !pending && auth.state.value.status === 'anonymous'" as-child class="w-full">
                <RouterLink :to="{ path: '/auth/login', query: { next: '/auth/invitation' } }">
                    登录后接受邀请
                </RouterLink>
            </Button>
            <Button
                v-if="token && !completed && !pending && auth.state.value.status === 'authenticated'"
                variant="link"
                class="w-full"
                @click="switchAccount"
            >
                切换账户
            </Button>
            <Button v-if="!token" as-child variant="outline" class="w-full">
                <RouterLink to="/auth/login">返回登录</RouterLink>
            </Button>
        </div>
    </AuthPage>
</template>
