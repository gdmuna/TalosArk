import { computed } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';

export function useQuerySelection(
    values: readonly string[],
    queryKey = 'view',
    defaultValue = values[0] ?? ''
) {
    const route = useRoute();
    const router = useRouter();
    const value = computed(() => {
        const requested = route.query[queryKey];
        return typeof requested === 'string' && values.includes(requested)
            ? requested
            : defaultValue;
    });
    function select(next: string, queryPatch: LocationQueryRaw = {}) {
        if (!values.includes(next)) return;
        const parameter = next === defaultValue ? undefined : next;
        if (route.query[queryKey] === parameter) return;
        const location = {
            path: route.path,
            query: { ...route.query, ...queryPatch, [queryKey]: parameter },
            hash: route.hash,
        };
        // Normalize the current selection without adding a history entry.
        return next === value.value ? router.replace(location) : router.push(location);
    }
    return { value, select };
}
