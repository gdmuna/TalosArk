import {
    computed,
    onScopeDispose,
    toValue,
    watch,
    watchEffect,
    type MaybeRefOrGetter,
    type Ref,
} from 'vue';
import { useWorkspaceStore } from '@/module/workspace';
import type { Resource } from './workbench';

export function useResourcePreview(
    selection: Ref<Resource | null>,
    resources: MaybeRefOrGetter<readonly Resource[]>,
    context: MaybeRefOrGetter<string> = ''
) {
    const workspace = useWorkspaceStore();
    const resource = computed({
        get: () => {
            const item = selection.value;
            if (!item || item.workspaceId !== workspace.activeId) return null;
            return (
                toValue(resources).find(
                    (current) =>
                        current.id === item.id && current.workspaceId === workspace.activeId
                ) ?? null
            );
        },
        set: (value: Resource | null) => {
            selection.value = value;
        },
    });
    const selectedId = computed({
        get: () => resource.value?.id ?? null,
        set: (id: string | null) => {
            resource.value =
                toValue(resources).find(
                    (item) => item.id === id && item.workspaceId === workspace.activeId
                ) ?? null;
        },
    });
    const open = computed({
        get: () => !!resource.value,
        set: (value: boolean) => {
            if (!value) resource.value = null;
        },
    });
    watch(
        [() => workspace.activeId, () => toValue(context)],
        () => {
            selection.value = null;
        },
        { flush: 'sync' }
    );
    // Reconcile stored objects with the latest summary; deletion also clears the ID, preventing resurrection.
    watchEffect(
        () => {
            if (selection.value !== resource.value) selection.value = resource.value;
        },
        { flush: 'sync' }
    );
    onScopeDispose(() => {
        selection.value = null;
    });
    return { resource, selectedId, open };
}
