import { onScopeDispose, ref, watch } from 'vue';
import type { MaterialBatch } from '../data/source';
import { useMaterialStore } from './store';
import { isResponseValidationError } from '@/platform/http';

export function useMaterialBatchRecovery(
    materialId: () => string,
    reload: () => Promise<boolean>,
    readFailure: () => unknown,
    batchId?: () => string
) {
    const store = useMaterialStore();
    const syncPending = ref(false);
    let generation = 0;
    let disposed = false;
    watch(
        [() => store.scope, materialId, () => batchId?.()],
        () => {
            generation++;
            syncPending.value = false;
        },
        { flush: 'sync' }
    );
    onScopeDispose(() => {
        disposed = true;
        generation++;
    });

    function isCurrentBatch(batch: MaterialBatch) {
        return (
            !disposed &&
            batch.organizationId === store.scope?.organizationId &&
            batch.workspaceId === store.scope?.workspaceId &&
            batch.materialId === materialId() &&
            (!batchId || batch.id === batchId())
        );
    }
    async function synchronize() {
        if (disposed) return false;
        const current = generation;
        store.error = '';
        const synchronized = await reload();
        if (current !== generation) return false;
        if (synchronized) syncPending.value = false;
        return synchronized;
    }
    async function afterCommit(batch: MaterialBatch) {
        if (!isCurrentBatch(batch)) return false;
        syncPending.value = true;
        return synchronize();
    }
    async function archive(batch: MaterialBatch, archived: boolean) {
        if (store.busy || syncPending.value || !isCurrentBatch(batch)) return;
        const current = generation;
        const saved = await store.mutate(({ source, scope, signal }) =>
            source.archiveBatch(
                scope,
                materialId(),
                batch.id,
                { expectedRevision: batch.revision, archived },
                signal
            )
        );
        if (saved && current === generation) await afterCommit(saved);
    }
    return {
        syncPending,
        synchronize,
        afterCommit,
        archive,
        showSyncError: () => syncPending.value && !isResponseValidationError(readFailure()),
    };
}
