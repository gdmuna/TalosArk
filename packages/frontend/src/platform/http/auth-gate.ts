import { createTaskScope, waitFor } from '../task';
import { AuthenticationError } from './error';

export interface AccessCredential {
    token: string;
    expiresAt: number;
}

export interface AuthLease extends AccessCredential {
    readonly epoch: number;
    readonly revision: number;
    readonly signal: AbortSignal;
}

export interface AuthGateOptions {
    refresh?: (signal: AbortSignal) => Promise<AccessCredential>;
    refreshTimeoutMs?: number;
    onExpired?: () => void;
}

export type AuthGate = ReturnType<typeof createAuthGate>;
export type AuthWait = 'wait' | 'fail';

export function createAuthGate(options: AuthGateOptions = {}) {
    let credential: AccessCredential | null = null;
    let epoch = 0;
    let revision = 0;
    let lifetime = new AbortController();
    let flight: { controller: AbortController; promise: Promise<AuthLease> } | null = null;
    let disposed = false;

    function lease(): AuthLease {
        if (!credential) throw new AuthenticationError('required');
        return { ...credential, epoch, revision, signal: lifetime.signal };
    }

    function setCredential(value: AccessCredential | null) {
        if (disposed) throw new Error('Authentication gate is disposed');
        if (value && (!value.token || !Number.isFinite(value.expiresAt))) {
            throw new TypeError('Invalid access credential');
        }
        const previousLifetime = lifetime;
        const previousFlight = flight;
        epoch++;
        revision++;
        flight = null;
        lifetime = new AbortController();
        credential = value ? { ...value } : null;
        previousLifetime.abort(new AuthenticationError('changed'));
        previousFlight?.controller.abort(new AuthenticationError('changed'));
    }

    function assertCurrent(expected: AuthLease) {
        if (disposed || expected.epoch !== epoch) throw new AuthenticationError('changed');
    }

    function invalidate(expected: AuthLease) {
        assertCurrent(expected);
        // An old 401 must not invalidate a newer access token.
        if (expected.revision !== revision) return;
        setCredential(null);
        options.onExpired?.();
    }

    async function recover(expected: AuthLease, signal: AbortSignal, wait: AuthWait = 'wait') {
        signal.throwIfAborted();
        assertCurrent(expected);
        if (expected.revision !== revision) return acquire(signal, wait);
        if (wait === 'fail') throw new AuthenticationError('busy');
        if (!flight) {
            if (!options.refresh) {
                invalidate(expected);
                throw new AuthenticationError('unavailable');
            }
            const refresh = options.refresh;
            const controller = new AbortController();
            const scope = createTaskScope([controller.signal], options.refreshTimeoutMs ?? 15_000);
            const currentFlight = {
                controller,
                promise: Promise.resolve().then(async () => {
                    try {
                        scope.signal.throwIfAborted();
                        const next = await waitFor(refresh(scope.signal), scope.signal);
                        assertCurrent(expected);
                        if (
                            !next.token ||
                            !Number.isFinite(next.expiresAt) ||
                            next.expiresAt <= Date.now()
                        ) {
                            throw new TypeError(
                                'Refresh returned an invalid or expired credential'
                            );
                        }
                        credential = { ...next };
                        revision++;
                        return lease();
                    } catch (error) {
                        if (expected.epoch !== epoch || disposed) {
                            throw new AuthenticationError('changed', error);
                        }
                        invalidate(expected);
                        throw new AuthenticationError('expired', error);
                    } finally {
                        scope.dispose();
                        if (flight === currentFlight) flight = null;
                    }
                }),
            };
            flight = currentFlight;
        }
        // Canceling one queued request does not cancel the shared refresh.
        return waitFor(flight.promise, signal);
    }

    async function acquire(signal: AbortSignal, wait: AuthWait = 'wait'): Promise<AuthLease> {
        signal.throwIfAborted();
        if (disposed) throw new AuthenticationError('changed');
        const current = lease();
        if (flight || current.expiresAt <= Date.now()) return recover(current, signal, wait);
        return current;
    }

    return {
        acquire,
        recover,
        invalidate,
        assertCurrent,
        setCredential,
        dispose() {
            if (disposed) return;
            setCredential(null);
            disposed = true;
            lifetime.abort(new AuthenticationError('changed'));
        },
    };
}
