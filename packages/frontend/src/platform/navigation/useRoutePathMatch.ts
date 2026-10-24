import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useRoute } from 'vue-router';
import { matchesRoutePath, type RoutePathMatchRule } from '@/shared/util';

/**
 * Reactively determines whether the current route path satisfies a match rule.
 * Query parameters and hashes are intentionally excluded because it uses route.path.
 */
export function useRoutePathMatch(source: MaybeRefOrGetter<RoutePathMatchRule>) {
    const route = useRoute();

    return computed(() => matchesRoutePath(route.path, toValue(source)));
}
