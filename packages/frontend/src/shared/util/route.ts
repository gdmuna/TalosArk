import { type RouteLocationNormalizedLoadedGeneric } from 'vue-router';

// prettier-ignore
export type RoutePathMatchRule =
    | string
    | {
        type: 'exact' | 'prefix' | 'contains';
        value: string;
    }
    | {
        type: 'pattern';
        value: RegExp;
    }
    | {
        type: 'predicate';
        value: (path: string) => boolean;
    };

export function matchesRoutePath(path: string, rule: RoutePathMatchRule) {
    const normalizedPath = normalizeRoutePath(path);

    if (typeof rule === 'string') {
        return normalizedPath === normalizeRoutePath(rule);
    }

    switch (rule.type) {
        case 'exact':
            return normalizedPath === normalizeRoutePath(rule.value);
        case 'prefix': {
            const prefix = normalizeRoutePath(rule.value);

            return prefix === '/'
                ? normalizedPath.startsWith('/')
                : normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
        }
        case 'contains':
            return normalizedPath.includes(rule.value);
        case 'pattern':
            return matchesPattern(normalizedPath, rule.value);
        case 'predicate':
            return rule.value(normalizedPath);
    }
}

function normalizeRoutePath(path: string) {
    return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function matchesPattern(path: string, pattern: RegExp) {
    const lastIndex = pattern.lastIndex;

    pattern.lastIndex = 0;
    const matches = pattern.test(path);
    pattern.lastIndex = lastIndex;

    return matches;
}

export function resolveDefaultTitle(
    route: RouteLocationNormalizedLoadedGeneric,
    fallback?: string
) {
    for (let i = route.matched.length - 1; i >= 0; i--) {
        const title = route.matched[i].meta.defaultTitle;
        if (title !== undefined) return title;
    }
    return fallback ?? '新标签页';
}
