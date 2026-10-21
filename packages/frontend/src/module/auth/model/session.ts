import { readonly, shallowRef } from 'vue';
import { SessionCredentialsSchema, type SessionCredentials } from '@talos-ark/contracts/auth';
import {
    AuthenticationError,
    HttpError,
    isResponseValidationError,
    createAuthGate,
    type AccessCredential,
} from '@/platform/http';
import { createTaskScope, waitFor } from '@/platform/task';

export interface AuthSessionState {
    status: 'unknown' | 'restoring' | 'authenticated' | 'anonymous' | 'error' | 'disposed';
    version: number;
    userId: string;
    notice: string;
    error: string;
}

export interface AuthSessionOptions {
    refresh?: (signal: AbortSignal) => Promise<SessionCredentials>;
}

export function createAuthSession(options: AuthSessionOptions = {}) {
    let credentials: SessionCredentials | null = null;
    let refresh = options.refresh;
    let restoration: { controller: AbortController; promise: Promise<void> } | undefined;
    const state = shallowRef<AuthSessionState>({
        status: 'unknown',
        version: 0,
        userId: '',
        notice: '',
        error: '',
    });

    function publish(status: AuthSessionState['status'], notice = '', error = '') {
        state.value = {
            status,
            version: state.value.version + 1,
            userId: credentials?.session.userId ?? '',
            notice,
            error,
        };
    }

    function validate(value: SessionCredentials) {
        const parsed = SessionCredentialsSchema.safeParse(value);
        if (!parsed.success) throw new HttpError('登录凭据响应无效', 'protocol');
        const next = parsed.data;
        if (
            Date.parse(next.session.idleExpiresAt) <= Date.now() ||
            toAccessCredential(next).expiresAt <= Date.now()
        ) {
            throw new HttpError('登录凭据响应已过期', 'protocol');
        }
        return next;
    }

    const gate = createAuthGate({
        onExpired(cause) {
            credentials = null;
            if (isResponseValidationError(cause)) {
                publish('error');
                return;
            }
            if (
                cause &&
                !(cause instanceof HttpError && cause.status === 401) &&
                !(cause instanceof AuthenticationError && cause.reason === 'changed')
            ) {
                publish('error', '', '暂时无法恢复登录会话，请检查网络后重试。');
            } else publish('anonymous', '登录已失效，请重新登录。');
        },
        async refresh(signal) {
            const current = credentials;
            if (!current || !refresh) throw new AuthenticationError('unavailable');
            const next = validate(await refresh(signal));
            signal.throwIfAborted();
            if (
                next.session.id !== current.session.id ||
                next.session.userId !== current.session.userId
            ) {
                throw new HttpError('刷新凭据响应身份不一致', 'protocol');
            }
            credentials = next;
            return toAccessCredential(next);
        },
    });

    function accept(value: SessionCredentials) {
        const next = validate(value);
        restoration?.controller.abort(new AuthenticationError('changed'));
        gate.setCredential(toAccessCredential(next));
        credentials = next;
        publish('authenticated');
    }

    function clear(notice = '', status: 'anonymous' | 'unknown' = 'anonymous') {
        restoration?.controller.abort(new AuthenticationError('changed'));
        gate.setCredential(null);
        credentials = null;
        publish(status, notice);
    }

    function restore(signal?: AbortSignal): Promise<void> {
        if (state.value.status === 'disposed')
            return Promise.reject(new AuthenticationError('changed'));
        if (credentials && state.value.status === 'authenticated') return Promise.resolve();
        if (!restoration) {
            const controller = new AbortController();
            const scope = createTaskScope([controller.signal], 15_000);
            const version = state.value.version;
            state.value = { ...state.value, status: 'restoring', error: '' };
            const current = {
                controller,
                promise: Promise.resolve().then(async () => {
                    try {
                        if (!refresh) throw new AuthenticationError('unavailable');
                        const next = validate(await waitFor(refresh(scope.signal), scope.signal));
                        scope.signal.throwIfAborted();
                        if (version !== state.value.version)
                            throw new AuthenticationError('changed');
                        gate.setCredential(toAccessCredential(next));
                        credentials = next;
                        publish('authenticated');
                    } catch (cause) {
                        if (version !== state.value.version || controller.signal.aborted) return;
                        credentials = null;
                        if (cause instanceof HttpError && cause.status === 401)
                            publish('anonymous');
                        else if (
                            cause instanceof AuthenticationError &&
                            cause.reason === 'required'
                        )
                            publish('anonymous');
                        else
                            publish(
                                'error',
                                '',
                                isResponseValidationError(cause)
                                    ? ''
                                    : cause instanceof HttpError && cause.status === 403
                                      ? '当前访问地址无权恢复登录会话。'
                                      : '暂时无法恢复登录会话，请检查网络后重试。'
                            );
                    } finally {
                        scope.dispose();
                        if (restoration === current) restoration = undefined;
                    }
                }),
            };
            restoration = current;
        }
        return signal ? waitFor(restoration.promise, signal) : restoration.promise;
    }

    return {
        state: readonly(state),
        gate,
        accept,
        clear,
        restore,
        setNotice(notice: string) {
            state.value = { ...state.value, notice };
        },
        connectRefresh(adapter: NonNullable<AuthSessionOptions['refresh']>) {
            refresh = adapter;
        },
        dispose() {
            restoration?.controller.abort(new AuthenticationError('changed'));
            credentials = null;
            gate.dispose();
            publish('disposed');
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
