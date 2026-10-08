import axios, { AxiosHeaders, type AxiosResponse } from 'axios';
import { ApiResponseSchema } from '@talos-ark/contracts/protocol';
import { createTaskScope, delay } from '../task';
import type { AuthLease } from './auth-gate';
import { AuthenticationError, HttpError } from './error';
import { parseRetryAfter, retryDelay, validateRetryPolicy } from './retry';
import type { HttpClient, HttpClientOptions, HttpRequest } from './type';

export function createHttpClient(options: HttpClientOptions): HttpClient {
    const base = new URL(options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`);
    if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash
    ) {
        throw new TypeError(
            'baseUrl must be an HTTP API root without credentials, query or fragment'
        );
    }
    const transport = axios.create({ withCredentials: true, validateStatus: () => true });
    const lifetime = new AbortController();
    const auth = options.auth;

    async function request<T>(input: HttpRequest<T>): Promise<T> {
        // Only module-owned relative paths may receive credentials.
        if (
            !input.path.startsWith('/') ||
            input.path.startsWith('//') ||
            input.path.includes('\\')
        ) {
            throw new TypeError('API path must start with a single slash');
        }
        const url = new URL(input.path.slice(1), base);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
            throw new TypeError('API path must stay inside baseUrl');
        }
        const retry = input.retry ?? options.retry ?? {};
        validateRetryPolicy(retry);
        const scope = createTaskScope(
            [input.signal, lifetime.signal],
            input.timeoutMs ?? options.timeoutMs ?? 30_000
        );
        let lease: AuthLease | undefined;
        let recovered = false;
        let attempt = 0;
        const requiresAuth = input.auth !== 'none';
        try {
            scope.signal.throwIfAborted();
            if (requiresAuth) {
                if (!auth) throw new AuthenticationError('required');
                lease = await auth.acquire(scope.signal, input.authWait);
            }
            while (true) {
                const sendScope = createTaskScope([scope.signal, lease?.signal]);
                try {
                    sendScope.signal.throwIfAborted();
                    if (lease && auth) {
                        auth.assertCurrent(lease);
                        // A concurrent refresh or expiration during backoff must be observed before sending.
                        lease = await auth.acquire(sendScope.signal, input.authWait);
                    }
                    const headers = new AxiosHeaders(input.headers);
                    headers.delete('Authorization');
                    if (lease) headers.set('Authorization', `Bearer ${lease.token}`);
                    const response = await transport.request<unknown, AxiosResponse<unknown>>({
                        url: url.href,
                        method: input.method,
                        data: input.body,
                        params: input.params,
                        headers,
                        signal: sendScope.signal,
                    });
                    sendScope.signal.throwIfAborted();
                    return decode(response, input);
                } catch (error) {
                    sendScope.signal.throwIfAborted();
                    const failure = normalize(error);
                    if (failure.status === 401 && lease && auth) {
                        if (recovered) {
                            auth.invalidate(lease);
                            throw failure;
                        }
                        lease = await auth.recover(lease, scope.signal, input.authWait);
                        recovered = true;
                        continue;
                    }
                    // No automatic network retry for writes, even if a caller supplies a policy.
                    const backoff =
                        input.method === 'GET' ? retryDelay(failure, ++attempt, retry) : null;
                    if (backoff === null) throw failure;
                    await delay(backoff, sendScope.signal);
                } finally {
                    sendScope.dispose();
                }
            }
        } finally {
            scope.dispose();
        }
    }

    return {
        request,
        dispose: () => lifetime.abort(new DOMException('HTTP client disposed', 'AbortError')),
    };
}

function decode<T>(response: AxiosResponse<unknown>, input: HttpRequest<T>): T {
    const retryAfter = parseRetryAfter(response.headers['retry-after']);
    const envelope = ApiResponseSchema.safeParse(response.data);
    const body = envelope.success ? envelope.data : undefined;
    if (body && !body.success)
        throw new HttpError(body.message, 'api', response.status, body, retryAfter);
    if (response.status < 200 || response.status >= 300) {
        throw new HttpError(
            `HTTP ${response.status}`,
            'http',
            response.status,
            undefined,
            retryAfter
        );
    }
    if (!body || !body.success) {
        throw new HttpError(
            'Invalid API response envelope',
            'protocol',
            response.status,
            undefined,
            undefined,
            envelope.success ? undefined : envelope.error
        );
    }
    const payload = input.schema.safeParse(body.data);
    if (!payload.success) {
        throw new HttpError(
            'Invalid API response data',
            'protocol',
            response.status,
            undefined,
            undefined,
            payload.error
        );
    }
    return payload.data;
}

function normalize(error: unknown): HttpError {
    if (error instanceof HttpError) return error;
    if (
        axios.isAxiosError(error) &&
        !error.response &&
        ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '')
    ) {
        return new HttpError(
            error.message,
            error.code === 'ERR_NETWORK' ? 'network' : 'timeout',
            undefined,
            undefined,
            undefined,
            error
        );
    }
    // Programming/configuration errors must not be misclassified as retryable network failures.
    throw error;
}
