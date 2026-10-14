import { readonly, shallowRef } from 'vue';
import type { Pinia } from 'pinia';
import { useAccountStore, type AccountDataSource } from '@/module/account';
import { useWorkspaceStore, type WorkspaceDataSource } from '@/module/workspace';
import { useWorkbenchStore, type WorkbenchDataSource } from '@/module/workbench';
import type { AuthApi } from '@/module/auth';
import { HttpError } from '@/platform/http';

export interface ApplicationDataSources {
    account: AccountDataSource;
    workspace?: WorkspaceDataSource;
    workbench?: WorkbenchDataSource;
}

export interface BootstrapState {
    status: 'idle' | 'loading' | 'error' | 'ready' | 'disposed';
    stage: string;
    error: string;
}

export function createApplicationBootstrap(
    pinia: Pinia,
    sources: ApplicationDataSources,
    auth: AuthApi
) {
    const account = useAccountStore(pinia);
    const workspace = useWorkspaceStore(pinia);
    const workbench = useWorkbenchStore(pinia);
    account.connect(sources.account);
    if (sources.workspace) workspace.connect(sources.workspace);
    if (sources.workbench) workbench.connect(sources.workbench);

    const state = shallowRef<BootstrapState>({ status: 'idle', stage: '', error: '' });
    let lifetime = new AbortController();
    let disposed = false;
    const stages = [
        {
            label: '登录会话',
            load: async (signal: AbortSignal) => {
                await auth.restore(signal);
                if (auth.state.value.status !== 'authenticated')
                    throw new Error(auth.state.value.error || '请先登录。');
            },
        },
        {
            label: '账户资料',
            load: async (signal: AbortSignal) => {
                await account.load(signal);
                if (account.profile?.id !== auth.state.value.userId) {
                    account.reset();
                    throw new Error('账户资料与当前登录会话不一致，请重新登录。');
                }
            },
        },
        ...(sources.workspace ? [{ label: '工作区', load: workspace.load }] : []),
        ...(sources.workbench ? [{ label: '工作台', load: workbench.load }] : []),
    ];
    let completed = 0;
    let pending: Promise<void> | undefined;

    async function load(controller: AbortController) {
        for (const stage of stages.slice(completed)) {
            if (controller.signal.aborted) return;
            state.value = { status: 'loading', stage: stage.label, error: '' };
            try {
                await stage.load(controller.signal);
                controller.signal.throwIfAborted();
                completed++;
            } catch (cause) {
                if (!controller.signal.aborted) {
                    state.value = {
                        status: 'error',
                        stage: stage.label,
                        error:
                            cause instanceof HttpError && cause.status === 403
                                ? '当前账户无权访问此内容。'
                                : cause instanceof Error
                                  ? cause.message
                                  : '读取失败，请稍后重试',
                    };
                }
                return;
            }
        }
        if (!controller.signal.aborted) state.value = { status: 'ready', stage: '', error: '' };
    }

    function start(): Promise<void> {
        if (disposed || completed === stages.length) return Promise.resolve();
        // Retries reuse the same sources and resume at the first unfinished read.
        if (!pending) {
            const controller = lifetime;
            const current = Promise.resolve()
                .then(() => load(controller))
                .finally(() => {
                    if (pending === current) pending = undefined;
                });
            pending = current;
        }
        return pending;
    }

    function reset() {
        if (disposed) return;
        lifetime.abort(new DOMException('Application session changed', 'AbortError'));
        lifetime = new AbortController();
        completed = 0;
        pending = undefined;
        account.reset();
        workspace.reset();
        workbench.reset();
        state.value =
            auth.state.value.status === 'error'
                ? { status: 'error', stage: '登录会话', error: auth.state.value.error }
                : { status: 'idle', stage: '', error: '' };
    }

    function dispose() {
        disposed = true;
        lifetime.abort(new DOMException('Application bootstrap disposed', 'AbortError'));
        state.value = { status: 'disposed', stage: '', error: '' };
    }

    return { state: readonly(state), start, reset, dispose };
}

export type ApplicationBootstrap = ReturnType<typeof createApplicationBootstrap>;
