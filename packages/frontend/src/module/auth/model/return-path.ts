const oidcReturnKey = 'talosark:oidc-return';

export function authReturnPath(value: unknown): string {
    if (typeof value !== 'string' || value.includes('\\') || /\s/.test(value)) return '/main';
    return /^\/main(?:\/|\?|#|$)/.test(value) ||
        value === '/auth/invitation' ||
        value === '/auth/set-password'
        ? value
        : '/main';
}

export function rememberOidcReturn(url: string, destination: unknown): void {
    const state = new URL(url).searchParams.get('state');
    try {
        sessionStorage.removeItem(oidcReturnKey);
        if (state)
            sessionStorage.setItem(
                oidcReturnKey,
                JSON.stringify({ state, path: authReturnPath(destination) })
            );
    } catch {
        // Login remains available when this tab cannot retain its return destination.
    }
}

export function takeOidcReturn(state: string): string {
    try {
        const stored = sessionStorage.getItem(oidcReturnKey);
        sessionStorage.removeItem(oidcReturnKey);
        const value = stored ? JSON.parse(stored) : null;
        return value?.state === state ? authReturnPath(value.path) : '/main';
    } catch {
        return '/main';
    }
}
