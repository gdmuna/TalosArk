import { computed, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { provideBreadcrumbs, type BreadcrumbEntry } from '@/component/breadcrumb';
import { useNavigationStore } from '@/platform/navigation';
import { useWorkbenchStore, type Resource } from '@/module/workbench';
import type { ResourceDomain } from '@/router/resource-navigation';
import ResourceBreadcrumbPicker from './ResourceBreadcrumbPicker.vue';

export function useResourceBreadcrumb(options: {
    domain: ResourceDomain;
    kind: Resource['kind'];
    listLabel: string;
    resource: Ref<{ name: string } | undefined>;
    resourceId: Ref<string>;
    search?: (
        query: string,
        page: number,
        signal: AbortSignal
    ) => Promise<{ items: Pick<Resource, 'id' | 'name'>[]; total: number }>;
    parents?: () => BreadcrumbEntry[];
}) {
    const route = useRoute();
    const navigation = useNavigationStore();
    const workbench = useWorkbenchStore();
    const listPath = `/main/${options.domain}/${options.domain === 'inventory' ? 'ledger' : 'list'}`;
    const returnTo = computed(() => navigation.lastLocation(listPath));
    provideBreadcrumbs(() => [
        { id: 'resource-list', label: options.listLabel, to: returnTo.value },
        {
            id: 'resource',
            label: options.resource.value?.name ?? options.resourceId.value,
            component: ResourceBreadcrumbPicker,
            props: {
                label: options.resource.value?.name ?? options.resourceId.value,
                activeId: options.resourceId.value,
                resources: workbench.currentResources.filter(
                    (resource) => resource.kind === options.kind
                ),
                search: options.search,
                onSelect: (resource: Resource) => {
                    const currentPath = `/main/${options.domain}/detail/${encodeURIComponent(options.resourceId.value)}`;
                    return navigation.pushPreservingOrigin({
                        path: `/main/${options.domain}/detail/${encodeURIComponent(resource.id)}`,
                        query: route.path === currentPath ? { view: route.query.view } : {},
                    });
                },
            },
        },
        ...(options.parents?.() ?? []),
    ]);
    return { returnTo };
}
