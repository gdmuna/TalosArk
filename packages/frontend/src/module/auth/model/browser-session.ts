import { AuthenticationError } from '@/platform/http';
import { createTaskScope } from '@/platform/task';

interface SessionMarker {
    revision: string;
    signedOut: boolean;
    confirmed: boolean;
}

export function createBrowserSessionCoordinator(apiRoot: string) {
    const key = `talosark:session:${new URL(apiRoot).href.replace(/\/+$/, '')}`;
    const lifetime = new AbortController();
    const listeners = new Set<(marker: SessionMarker) => void>();
    let storageAvailable = true;

    function read(): SessionMarker | null {
        let text: string | null;
        try {
            text = localStorage.getItem(key);
        } catch {
            storageAvailable = false;
            return null;
        }
        if (!text) return null;
        let value: unknown;
        try {
            value = JSON.parse(text);
        } catch {
            return null;
        }
        if (!value || typeof value !== 'object') return null;
        const marker = value as Partial<SessionMarker>;
        return typeof marker.revision === 'string' &&
            typeof marker.signedOut === 'boolean' &&
            typeof marker.confirmed === 'boolean'
            ? (marker as SessionMarker)
            : null;
    }

    function write(marker: SessionMarker) {
        // Persist only a coordination marker, never AT, RT or account information.
        localStorage.setItem(key, JSON.stringify(marker));
        return marker;
    }

    function mark(signedOut: boolean, confirmed = false) {
        return write({ revision: crypto.randomUUID(), signedOut, confirmed });
    }

    function assertCurrent(revision: string | undefined) {
        if (read()?.revision !== revision) throw new AuthenticationError('changed');
    }

    function automaticResumeAllowed() {
        return !read()?.signedOut;
    }

    async function run<T>(
        operation: (signal: AbortSignal) => Promise<T>,
        signal?: AbortSignal,
        timeoutMs = 30_000
    ): Promise<T> {
        if (!navigator.locks)
            throw new Error('当前浏览器无法安全协调登录会话，请使用 HTTPS 或 localhost。');
        if (!storageAvailable)
            throw new Error('当前浏览器无法使用站点存储，不能安全恢复登录会话。');
        const scope = createTaskScope([signal, lifetime.signal], timeoutMs);
        try {
            return await navigator.locks.request(key, { signal: scope.signal }, () => {
                scope.signal.throwIfAborted();
                return operation(scope.signal);
            });
        } finally {
            scope.dispose();
        }
    }

    function onStorage(event: StorageEvent) {
        if (event.storageArea !== localStorage || event.key !== key) return;
        const marker = read();
        if (marker) for (const listener of listeners) listener(marker);
    }
    window.addEventListener('storage', onStorage);

    return {
        read,
        mark,
        assertCurrent,
        automaticResumeAllowed,
        run,
        confirmSignOut(marker: SessionMarker, confirmed: boolean) {
            if (read()?.revision === marker.revision) write({ ...marker, confirmed });
        },
        subscribe(listener: (marker: SessionMarker) => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            lifetime.abort(new DOMException('Session coordination disposed', 'AbortError'));
            listeners.clear();
            window.removeEventListener('storage', onStorage);
        },
    };
}

export type BrowserSessionCoordinator = ReturnType<typeof createBrowserSessionCoordinator>;
