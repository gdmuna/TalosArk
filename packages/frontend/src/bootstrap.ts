import { readonly, shallowRef } from 'vue';
import type { Pinia } from 'pinia';
import { useAccountStore, type AccountDataSource } from '@/module/account';
import { useWorkspaceStore, type WorkspaceDataSource } from '@/module/workspace';
import { useWorkbenchStore, type WorkbenchDataSource } from '@/module/workbench';
import { createMockAccountDataSource } from '@/module/account/data/mock';
import { createMockWorkspaceDataSource } from '@/module/workspace/data/mock';
import { createMockWorkbenchDataSource } from '@/module/workbench/data/mock';

export interface ApplicationDataSources {
    account: AccountDataSource;
    workspace: WorkspaceDataSource;
    workbench: WorkbenchDataSource;
}

export interface BootstrapState {
    status: 'idle' | 'loading' | 'error' | 'ready' | 'disposed';
    stage: string;
    error: string;
}

export function createApplicationBootstrap(
    pinia: Pinia,
    sources: Partial<ApplicationDataSources> = {}
) {
    const account = useAccountStore(pinia);
    const workspace = useWorkspaceStore(pinia);
    const workbench = useWorkbenchStore(pinia);
    account.connect(sources.account ?? createMockAccountDataSource());
    workspace.connect(sources.workspace ?? createMockWorkspaceDataSource());
    workbench.connect(sources.workbench ?? createMockWorkbenchDataSource());

    const state = shallowRef<BootstrapState>({ status: 'idle', stage: '', error: '' });
    const lifetime = new AbortController();
    const stages = [
        { label: '账户资料', load: account.load },
        { label: '工作区', load: workspace.load },
        { label: '工作台', load: workbench.load },
    ];
    let completed = 0;
    let pending: Promise<void> | undefined;

    async function load() {
        for (const stage of stages.slice(completed)) {
            if (lifetime.signal.aborted) return;
            state.value = { status: 'loading', stage: stage.label, error: '' };
            try {
                await stage.load(lifetime.signal);
                lifetime.signal.throwIfAborted();
                completed++;
            } catch (cause) {
                if (!lifetime.signal.aborted) {
                    state.value = {
                        status: 'error',
                        stage: stage.label,
                        error: cause instanceof Error ? cause.message : '读取失败，请稍后重试',
                    };
                }
                return;
            }
        }
        if (!lifetime.signal.aborted) state.value = { status: 'ready', stage: '', error: '' };
    }

    function start(): Promise<void> {
        if (lifetime.signal.aborted || completed === stages.length) return Promise.resolve();
        // Retries reuse the same sources and resume at the first unfinished read.
        pending ??= Promise.resolve()
            .then(load)
            .finally(() => {
                pending = undefined;
            });
        return pending;
    }

    function dispose() {
        lifetime.abort(new DOMException('Application bootstrap disposed', 'AbortError'));
        state.value = { status: 'disposed', stage: '', error: '' };
    }

    return { state: readonly(state), start, dispose };
}

export type ApplicationBootstrap = ReturnType<typeof createApplicationBootstrap>;
