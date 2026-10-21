import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export function useResourceQuery() {
    const route = useRoute();
    const router = useRouter();
    let targetQuery = route.query.q ?? '';
    const query = ref(typeof targetQuery === 'string' ? targetQuery : '');
    watch(
        () => route.query.q,
        (value) => {
            targetQuery = value ?? '';
            query.value = typeof value === 'string' ? value : '';
        }
    );
    // Dispatch search writes before a subsequent page navigation.
    watch(
        query,
        (value) => {
            if (value === targetQuery) return;
            // Include pending navigation so a rapid edit can restore the original value.
            targetQuery = value;
            router.replace({
                path: route.path,
                query: { ...route.query, q: value || undefined },
                hash: route.hash,
            });
        },
        { flush: 'sync' }
    );
    return query;
}
