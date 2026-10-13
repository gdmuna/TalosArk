import type { BrowserOriginPolicy } from '@/config/http.config.js';

export function isAllowedBrowserOrigin(origin: unknown, policy: BrowserOriginPolicy): boolean {
    if (typeof origin !== 'string') return false;
    let url: URL;
    try {
        url = new URL(origin);
    } catch {
        return false;
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) return false;
    switch (policy.mode) {
        case 'deny':
            return false;
        case 'allowlist':
            return policy.origins.includes(origin);
        case 'development-loopback':
            return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        case 'development-any':
            return true;
    }
}
