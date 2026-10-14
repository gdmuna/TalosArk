import {
    OidcLoginCallbackBodySchema,
    type OidcLoginCallbackBody,
    type OidcLoginCallbackResponse,
    PasswordRecoveryRequestBodySchema,
    PasswordRecoveryConfirmBodySchema,
    type PasswordRecoveryRequestBody,
    type PasswordRecoveryConfirmBody,
    PasswordLoginBodySchema,
    AccountActivateBodySchema,
    PasswordSetBodySchema,
    type PasswordLoginBody,
    type AccountActivateBody,
    type PasswordSetBody,
} from '@talos-ark/contracts/auth';
import { AuthenticationError, type RequestOptions } from '@/platform/http';
import type { AuthDataSource } from '../data/source';
import type { AuthSession } from './session';
import type { BrowserSessionCoordinator } from './browser-session';

export function createAuthActions(
    source: AuthDataSource,
    session: AuthSession,
    coordinator: BrowserSessionCoordinator
) {
    let loginRevision = 0;
    let logoutFlight: Promise<{ revoked: boolean }> | undefined;
    let disposed = false;

    const marker = coordinator.read();
    let observedRevision = marker?.revision;
    function markSession(signedOut: boolean, confirmed = false) {
        const next = coordinator.mark(signedOut, confirmed);
        observedRevision = next.revision;
        return next;
    }
    if (marker?.signedOut)
        session.clear(marker.confirmed ? '' : '本地已退出，服务器会话撤销未确认。');
    const unsubscribe = coordinator.subscribe((next) => {
        const notice = next.confirmed ? '已退出登录。' : '本地已退出，服务器会话撤销未确认。';
        if (next.revision === observedRevision) {
            if (next.signedOut && session.state.value.status === 'anonymous')
                session.setNotice(notice);
            return;
        }
        observedRevision = next.revision;
        loginRevision++;
        session.clear(next.signedOut ? notice : '', next.signedOut ? 'anonymous' : 'unknown');
    });

    session.connectRefresh((signal) => {
        const revision = coordinator.read()?.revision;
        return coordinator.run(
            async (requestSignal) => {
                coordinator.assertCurrent(revision);
                if (!coordinator.automaticResumeAllowed())
                    throw new AuthenticationError('required');
                const next = await source.refreshSession({ signal: requestSignal });
                requestSignal.throwIfAborted();
                coordinator.assertCurrent(revision);
                return next;
            },
            signal,
            15_000
        );
    });

    function assertLogin(
        revision: number,
        version: number,
        markerRevision: string | undefined,
        signal: AbortSignal
    ) {
        signal.throwIfAborted();
        coordinator.assertCurrent(markerRevision);
        if (disposed || revision !== loginRevision || version !== session.state.value.version)
            throw new AuthenticationError('changed');
    }

    async function passwordLogin(body: PasswordLoginBody, options: RequestOptions = {}) {
        const payload = PasswordLoginBodySchema.parse(body);
        const revision = ++loginRevision;
        const version = session.state.value.version;
        const markerRevision = coordinator.read()?.revision;
        return coordinator.run(
            async (signal) => {
                assertLogin(revision, version, markerRevision, signal);
                const response = await source.passwordLogin(payload, { ...options, signal });
                assertLogin(revision, version, markerRevision, signal);
                markSession(false);
                session.accept(response);
                return response;
            },
            options.signal,
            options.timeoutMs
        );
    }

    async function completeOidcLogin(
        body: OidcLoginCallbackBody,
        options: RequestOptions = {}
    ): Promise<OidcLoginCallbackResponse> {
        const payload = OidcLoginCallbackBodySchema.parse(body);
        const revision = ++loginRevision;
        const version = session.state.value.version;
        const markerRevision = coordinator.read()?.revision;
        return coordinator.run(
            async (signal) => {
                assertLogin(revision, version, markerRevision, signal);
                const response = await source.completeOidcLogin(payload, { ...options, signal });
                assertLogin(revision, version, markerRevision, signal);
                if (response.type === 'success') {
                    markSession(false);
                    session.accept(response.data);
                }
                return response;
            },
            options.signal,
            options.timeoutMs
        );
    }

    function clearLocalSession(confirmed = false) {
        if (disposed) throw new AuthenticationError('changed');
        loginRevision++;
        markSession(true, confirmed);
        session.clear();
    }

    function logout(): Promise<{ revoked: boolean }> {
        if (disposed) return Promise.resolve({ revoked: false });
        if (logoutFlight) return logoutFlight;
        loginRevision++;
        let signedOut: ReturnType<BrowserSessionCoordinator['mark']>;
        try {
            signedOut = markSession(true);
        } catch {
            session.clear('本地已退出，服务器会话撤销未确认。');
            return Promise.resolve({ revoked: false });
        }
        session.clear('正在确认服务器会话撤销。');
        logoutFlight = coordinator
            .run(async (signal) => {
                coordinator.assertCurrent(signedOut.revision);
                await source.logout({ signal });
                coordinator.assertCurrent(signedOut.revision);
                coordinator.confirmSignOut(signedOut, true);
            })
            .then(() => {
                if (disposed) return { revoked: true };
                if (
                    coordinator.read()?.revision === signedOut.revision &&
                    session.state.value.status === 'anonymous'
                )
                    session.setNotice('已退出登录。');
                return { revoked: true };
            })
            .catch(() => {
                if (
                    !disposed &&
                    coordinator.read()?.revision === signedOut.revision &&
                    session.state.value.status === 'anonymous'
                )
                    session.setNotice('本地已退出，服务器会话撤销未确认。');
                return { revoked: false };
            })
            .finally(() => {
                logoutFlight = undefined;
            });
        return logoutFlight;
    }

    async function setFirstPassword(body: PasswordSetBody, options: RequestOptions = {}) {
        const payload = PasswordSetBodySchema.parse(body);
        const revision = ++loginRevision;
        const version = session.state.value.version;
        const markerRevision = coordinator.read()?.revision;
        // Acquire before the Cookie lock; refreshing while holding it would deadlock.
        const controller = new AbortController();
        await session.gate.acquire(options.signal ?? controller.signal);
        return coordinator.run(
            async (signal) => {
                assertLogin(revision, version, markerRevision, signal);
                const response = await source.setFirstPassword(payload, {
                    ...options,
                    signal,
                    authWait: 'fail',
                });
                assertLogin(revision, version, markerRevision, signal);
                markSession(false);
                session.accept(response);
                return response;
            },
            options.signal,
            options.timeoutMs
        );
    }

    async function confirmPasswordRecovery(
        body: PasswordRecoveryConfirmBody,
        options: RequestOptions = {}
    ) {
        const revision = loginRevision;
        const payload = PasswordRecoveryConfirmBodySchema.parse(body);
        return coordinator.run(
            async (signal) => {
                const response = await source.confirmPasswordRecovery(payload, {
                    ...options,
                    signal,
                });
                signal.throwIfAborted();
                if (revision === loginRevision) clearLocalSession(true);
                return response;
            },
            options.signal,
            options.timeoutMs
        );
    }

    return {
        state: session.state,
        restore: session.restore,
        passwordLogin,
        activateAccount: (body: AccountActivateBody, options?: RequestOptions) =>
            source.activateAccount(AccountActivateBodySchema.parse(body), options),
        setFirstPassword,
        logout,
        startOidcLogin: (options: RequestOptions = {}) =>
            coordinator.run(
                (signal) => source.startOidcLogin({ ...options, signal }),
                options.signal,
                options.timeoutMs
            ),
        completeOidcLogin,
        clearLocalSession,
        requestPasswordRecovery: (body: PasswordRecoveryRequestBody, options?: RequestOptions) =>
            source.requestPasswordRecovery(PasswordRecoveryRequestBodySchema.parse(body), options),
        confirmPasswordRecovery,
        dispose() {
            disposed = true;
            loginRevision++;
            unsubscribe();
            coordinator.dispose();
        },
    };
}

export type AuthApi = ReturnType<typeof createAuthActions>;
