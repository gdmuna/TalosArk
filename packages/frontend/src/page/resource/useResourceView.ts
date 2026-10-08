import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export function useResourceView(ids: readonly string[], defaultView = ids[0] ?? '') {
    const route = useRoute();
    const router = useRouter();
    const view = computed(() =>
        typeof route.query.view === 'string' && ids.includes(route.query.view)
            ? route.query.view
            : defaultView
    );
    function select(id: string) {
        if (!ids.includes(id) || id === view.value) return;
        return router.push({
            query: { ...route.query, view: id === defaultView ? undefined : id },
        });
    }
    return { view, select };
}
