import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useWorkbenchStore, type Resource } from '@/module/workbench';
import { useWorkspaceStore } from '@/module/workspace';

export function useResource(kind: Resource['kind']) {
    const route = useRoute();
    const workbench = useWorkbenchStore();
    const workspace = useWorkspaceStore();
    const resourceId = computed(() => String(route.params.resourceId ?? ''));
    const resource = computed(() => {
        const item = workbench.resourceById.get(resourceId.value);
        return item?.kind === kind ? item : undefined;
    });
    return { resource, resourceId, workspace };
}
