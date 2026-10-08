import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export type ManagementView = { value: string; label: string };

export function useManagementView(views: readonly ManagementView[], queryKey = 'view') {
    const route = useRoute();
    const router = useRouter();
    return computed({
        get: () =>
            views.find((item) => item.value === route.query[queryKey])?.value ?? views[0].value,
        set: (value: string) => {
            void router.push({
                query: { ...route.query, [queryKey]: value === views[0].value ? undefined : value },
            });
        },
    });
}
