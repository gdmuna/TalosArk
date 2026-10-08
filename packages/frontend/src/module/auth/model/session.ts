import { SessionCredentialsSchema, type SessionCredentials } from '@talos-ark/contracts/auth';
import { createAuthGate, type AccessCredential } from '@/platform/http';

export interface AuthSessionOptions {
    // Supplied only after the backend refresh contract is implemented and agreed.
    refresh?: (credentials: SessionCredentials, signal: AbortSignal) => Promise<SessionCredentials>;
}

export function createAuthSession(options: AuthSessionOptions = {}) {
    let credentials: SessionCredentials | null = null;
    const refresh = options.refresh;
    const gate = createAuthGate({
        onExpired: () => {
            credentials = null;
        },
        // prettier-ignore
        refresh: refresh
            ? async (signal) => {
                const current = credentials;
                if (
                    !current ||
                    Date.parse(current.tokenPair.refreshToken.expiresAt) <= Date.now() ||
                    Date.parse(current.session.idleExpiresAt) <= Date.now()
                ) {
                    throw new Error('Session cannot be refreshed');
                }
                const next = SessionCredentialsSchema.parse(await refresh(current, signal));
                signal.throwIfAborted();
                if (
                    next.session.id !== current.session.id ||
                    next.session.userId !== current.session.userId
                ) {
                    throw new Error('Refresh must not change the session identity');
                }
                const access = toAccessCredential(next);
                if (access.expiresAt <= Date.now())
                    throw new Error('Refresh returned an expired access token');
                credentials = next;
                return access;
            }
            : undefined,
    });

    function accept(value: SessionCredentials) {
        const next = SessionCredentialsSchema.parse(value);
        gate.setCredential(toAccessCredential(next));
        credentials = next;
    }

    function clear() {
        gate.setCredential(null);
        credentials = null;
    }

    return {
        gate,
        accept,
        clear,
        dispose() {
            credentials = null;
            gate.dispose();
        },
    };
}

function toAccessCredential(credentials: SessionCredentials): AccessCredential {
    return {
        token: credentials.tokenPair.accessToken.value,
        expiresAt: Date.parse(credentials.tokenPair.accessToken.expiresAt),
    };
}

export type AuthSession = ReturnType<typeof createAuthSession>;
