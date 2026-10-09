import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export function useResourceQuery() {
    const route = useRoute();
    const router = useRouter();
    const query = ref(typeof route.query.q === 'string' ? route.query.q : '');
    watch(
        () => route.query.q,
        (value) => {
            query.value = typeof value === 'string' ? value : '';
        }
    );
    watch(query, (value) => {
        if (value === (route.query.q ?? '')) return;
        router.replace({ query: { ...route.query, q: value || undefined } });
    });
    return query;
}
