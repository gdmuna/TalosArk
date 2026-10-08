import { HttpError } from './http.error.js';
import { assertDuration, createRequestScope, waitFor } from './request-scope.js';
import type { HttpHeaders } from './type.js';

export interface HttpCredential {
    headers: HttpHeaders;
    expiresAt: number;
}

export interface CredentialLease extends HttpCredential {
    scope: string;
    epoch: number;
    revision: number;
    signal: AbortSignal;
}

export interface CredentialGateOptions {
    /** One gate per tenant/principal credential scope; never a token value. */
    scope: string;
    credential?: HttpCredential;
    refresh?: (signal: AbortSignal) => Promise<HttpCredential>;
    refreshTimeoutMs?: number;
}

export type CredentialWait = 'wait' | 'fail';
export type CredentialGate = ReturnType<typeof createCredentialGate>;

export function createCredentialGate(options: CredentialGateOptions) {
    options = { ...options };
    if (!options.scope) throw new TypeError('Credential scope is required');
    const refreshTimeout = options.refreshTimeoutMs ?? 15_000;
    assertDuration(refreshTimeout, 'refreshTimeoutMs');
    let credential = options.credential ? copyCredential(options.credential) : null;
    let epoch = 0;
    let revision = 0;
    let disposed = false;
    let lifetime = new AbortController();
    let flight: { promise: Promise<CredentialLease>; controller: AbortController } | null = null;
    const failure = (
        reason:
            | 'authentication-required'
            | 'authentication-busy'
            | 'authentication-changed'
            | 'authentication-expired',
        cause?: unknown
    ) => new HttpError({ reason, operation: 'credential.refresh' }, { cause });

    function lease(): CredentialLease {
        return {
            headers: credential?.headers ?? {},
            expiresAt: credential?.expiresAt ?? 0,
            scope: options.scope,
            epoch,
            revision,
            signal: lifetime.signal,
        };
    }

    function assertCurrent(expected: CredentialLease) {
        if (
            disposed ||
            expected.epoch !== epoch ||
            expected.scope !== options.scope ||
            expected.signal !== lifetime.signal
        )
            throw failure('authentication-changed');
    }

    function setCredential(value: HttpCredential | null) {
        if (disposed) throw failure('authentication-changed');
        const next = value ? copyCredential(value) : null;
        const previous = lifetime;
        const previousFlight = flight;
        epoch++;
        revision++;
        credential = next;
        flight = null;
        lifetime = new AbortController();
        previous.abort(failure('authentication-changed'));
        previousFlight?.controller.abort(failure('authentication-changed'));
    }

    function invalidate(expected: CredentialLease) {
        assertCurrent(expected);
        // A delayed 401 cannot invalidate the credentials issued by a newer refresh.
        if (expected.revision === revision) credential = null;
    }

    async function recover(
        expected: CredentialLease,
        signal: AbortSignal,
        wait: CredentialWait = 'wait'
    ): Promise<CredentialLease> {
        signal.throwIfAborted();
        assertCurrent(expected);
        if (expected.revision !== revision) return acquire(signal, wait);
        if (wait === 'fail') throw failure('authentication-busy');
        if (!flight) {
            if (!options.refresh) throw failure('authentication-required');
            const refresh = options.refresh;
            const controller = new AbortController();
            const scope = createRequestScope(
                'credential.refresh',
                [controller.signal],
                refreshTimeout
            );
            const current = {
                controller,
                promise: Promise.resolve().then(async () => {
                    try {
                        scope.signal.throwIfAborted();
                        const next = copyCredential(
                            await waitFor(refresh(scope.signal), scope.signal)
                        );
                        assertCurrent(expected);
                        if (next.expiresAt <= Date.now())
                            throw new TypeError('Refresh returned expired credentials');
                        credential = next;
                        revision++;
                        return lease();
                    } catch (error) {
                        assertCurrent(expected);
                        credential = null;
                        // Normalize only recognized technical failures, not bugs in the provider callback.
                        if (error instanceof HttpError)
                            throw failure('authentication-expired', error);
                        throw error;
                    } finally {
                        scope.dispose();
                        if (flight === current) flight = null;
                    }
                }),
            };
            flight = current;
        }
        return waitFor(flight.promise, signal);
    }

    async function acquire(
        signal: AbortSignal,
        wait: CredentialWait = 'wait'
    ): Promise<CredentialLease> {
        signal.throwIfAborted();
        if (disposed) throw failure('authentication-changed');
        if (flight || !credential || credential.expiresAt <= Date.now())
            return recover(lease(), signal, wait);
        return lease();
    }

    return {
        acquire,
        recover,
        assertCurrent,
        invalidate,
        setCredential,
        dispose() {
            if (disposed) return;
            setCredential(null);
            disposed = true;
            lifetime.abort(failure('authentication-changed'));
        },
    };
}

function copyCredential(value: HttpCredential): HttpCredential {
    if (
        !Number.isFinite(value.expiresAt) ||
        !Object.keys(value.headers).length ||
        Object.values(value.headers).some((header) => typeof header !== 'string')
    ) {
        throw new TypeError('Invalid HTTP credential');
    }
    return { headers: Object.freeze({ ...value.headers }), expiresAt: value.expiresAt };
}
