import { watch } from 'vue';
import { useRoute, useRouter, type Router } from 'vue-router';

export function consumeQuery(router: Router, keys: readonly string[]) {
    const { path, query, hash } = router.currentRoute.value;
    if (!keys.some((key) => Object.hasOwn(query, key))) return;
    const remaining = { ...query };
    for (const key of keys) delete remaining[key];
    return router.replace({ path, query: remaining, hash });
}

export function useQueryCommand(key: string, execute: (value: string) => void) {
    const router = useRouter();
    const path = useRoute().path;
    watch(
        () =>
            router.currentRoute.value.path === path
                ? router.currentRoute.value.query[key]
                : undefined,
        async (value) => {
            if (value === undefined) return;
            const failure = await consumeQuery(router, [key]);
            if (!failure && router.currentRoute.value.path === path && typeof value === 'string')
                execute(value);
        },
        { immediate: true }
    );
}
