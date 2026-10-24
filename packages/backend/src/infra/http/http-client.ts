import type { CredentialLease } from './credential-gate.js';
import { createAxiosTransport, type WireRequest } from './axios.transport.js';
import { HttpError } from './http.error.js';
import { RequestQueue } from './request-queue.js';
import { assertDuration, createRequestScope, delay, waitFor } from './request-scope.js';
import { parseRetryAfter, retryDelay, validateRetryPolicy, type RetryPolicy } from './retry.js';
import { Singleflight } from './singleflight.js';
import { observeHttpAttempt, observeHttpCall, observeHttpWait } from './http.telemetry.js';
import type {
    DecodedHttpRequest,
    HttpClient,
    HttpClientOptions,
    HttpHeaders,
    HttpObservation,
    HttpRequest,
    HttpResponse,
} from './type.js';

import { createSecureRandomString, hashSHA256 } from '@/common/utils/crypto.js';

import { Stream } from 'node:stream';

const successStatus = (status: number) => status >= 200 && status < 300;

export function createHttpClient(
    options: HttpClientOptions,
    observe?: (event: HttpObservation) => void
): HttpClient {
    options = { ...options, proxy: options.proxy ? { ...options.proxy } : false };
    assertLabel(options.name);
    const root = new URL(options.baseUrl);
    if (
        !['http:', 'https:'].includes(root.protocol) ||
        root.username ||
        root.password ||
        root.search ||
        root.hash
    ) {
        throw new TypeError('Expected an HTTP(S) API root without credentials, query or fragment');
    }
    root.pathname = root.pathname.replace(/\/+$/, '') + '/';
    const timeoutMs = options.timeoutMs ?? 30_000;
    const defaultRetry: RetryPolicy | false =
        options.retry === false ? false : Object.freeze({ ...options.retry });
    assertDuration(timeoutMs, 'timeoutMs');
    validateRetryPolicy(defaultRetry);
    for (const limit of [options.maxRequestBytes, options.maxResponseBytes]) {
        if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
            throw new RangeError('Body limits must be positive safe integers');
    }
    const concurrency = options.concurrency ?? 16;
    const maxQueue = options.maxQueue ?? 128;
    const queue = new RequestQueue(concurrency, maxQueue);
    const flights = new Singleflight<HttpResponse>(concurrency + maxQueue);
    const defaults = normalizeHeaders(options.headers ?? {});
    const salt = createSecureRandomString();
    const transport = createAxiosTransport(options, concurrency);
    const lifetime = new AbortController();
    const gate = options.credentialGate;
    const functionId = new WeakMap<object, number>();
    let nextFunctionId = 0;
    let pending = 0;

    function identify(value: object | undefined) {
        if (!value) return 0;
        if (!functionId.has(value)) functionId.set(value, ++nextFunctionId);
        return functionId.get(value);
    }

    function prepare(input: HttpRequest): WireRequest {
        assertLabel(input.operation);
        if (!['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(input.method))
            throw new TypeError('Unsupported HTTP method');
        if (
            !input.path.startsWith('/') ||
            input.path.startsWith('//') ||
            input.path.includes('#') ||
            /\\|%(?:2f|5c)/i.test(input.path.split('?')[0])
        ) {
            throw new TypeError('Expected an owner-local API path');
        }
        const target = new URL(input.path.slice(1), root);
        if (target.origin !== root.origin || !target.pathname.startsWith(root.pathname))
            throw new TypeError('Request escaped its configured API root');
        for (const [name, value] of Object.entries(input.params ?? {})) {
            if (value === undefined) continue;
            for (const entry of Array.isArray(value) ? value : [value])
                target.searchParams.append(name, String(entry));
        }
        const headers = { ...defaults, ...normalizeHeaders(input.headers ?? {}) };
        let body = input.body;
        if (body instanceof URLSearchParams) {
            body = body.toString();
            headers['content-type'] ??= 'application/x-www-form-urlencoded';
        } else if (Buffer.isBuffer(body)) body = Buffer.from(body);
        else if (body !== undefined && typeof body !== 'string' && !(body instanceof Stream)) {
            body = JSON.stringify(body);
            headers['content-type'] ??= 'application/json';
        }
        return {
            operation: input.operation,
            method: input.method,
            url: target.toString(),
            headers,
            body,
            responseType: input.responseType === 'binary' ? 'binary' : 'text',
        };
    }

    async function execute(
        input: HttpRequest,
        wire: WireRequest,
        signal: AbortSignal,
        initialLease?: CredentialLease
    ): Promise<HttpResponse> {
        const start = performance.now();
        let attempts = 0;
        let failedAttempt = 0;
        let recovered = false;
        let lease = initialLease;
        let finalResponse: HttpResponse | undefined;
        let outcome: HttpObservation['outcome'] = 'unexpected';
        const retry = input.retry ?? defaultRetry;
        const replayable =
            !(wire.body instanceof Stream) &&
            (input.replay === 'safe' ||
                (input.replay !== 'never' && ['GET', 'HEAD'].includes(input.method)));
        try {
            for (;;) {
                signal.throwIfAborted();
                if (lease) {
                    gate?.assertCurrent(lease);
                    lease = gate
                        ? await observeHttpWait(options.name, input.operation, 'credential', () =>
                              gate.acquire(signal, input.authWait)
                          )
                        : undefined;
                }
                const release = await observeHttpWait(
                    options.name,
                    input.operation,
                    'send-slot',
                    () => queue.acquire(input.operation, signal)
                );
                let response: HttpResponse | undefined;
                let error: unknown;
                try {
                    signal.throwIfAborted();
                    if (lease) gate?.assertCurrent(lease);
                    attempts++;
                    response = await observeHttpAttempt(
                        options.name,
                        input.operation,
                        input.method,
                        attempts,
                        () =>
                            transport.send(
                                {
                                    ...wire,
                                    headers: {
                                        ...wire.headers,
                                        ...normalizeHeaders(lease?.headers ?? {}),
                                    },
                                },
                                signal
                            )
                    );
                    finalResponse = response;
                } catch (cause) {
                    error = cause;
                } finally {
                    release();
                }

                if (response) {
                    if ((input.acceptStatus ?? successStatus)(response.status)) {
                        outcome = 'success';
                        return response;
                    }
                    error = new HttpError({
                        reason: 'http-status',
                        operation: input.operation,
                        upstreamStatus: response.status,
                        response,
                        retryAfterMs: parseRetryAfter(
                            typeof response.headers['retry-after'] === 'string'
                                ? response.headers['retry-after']
                                : undefined
                        ),
                    });
                    if (response.status === 401 && lease && gate) {
                        if (recovered || !replayable) {
                            gate.invalidate(lease);
                            throw error;
                        }
                        // Refresh uses a separate ungated client, outside this client's admission queue.
                        const previous = lease;
                        lease = await observeHttpWait(
                            options.name,
                            input.operation,
                            'credential',
                            () => gate.recover(previous, signal, input.authWait)
                        );
                        recovered = true;
                        continue;
                    }
                }
                if (signal.aborted) throw signal.reason;
                if (!(error instanceof HttpError)) throw error;
                const backoff = replayable ? retryDelay(error, ++failedAttempt, retry) : null;
                if (backoff === null) throw error;
                await delay(backoff, signal);
            }
        } catch (error) {
            outcome = error instanceof HttpError ? error.failure.reason : 'unexpected';
            throw error;
        } finally {
            observe?.({
                upstream: options.name,
                operation: input.operation,
                attempts,
                durationMs: Math.round(performance.now() - start),
                upstreamStatus: finalResponse?.status,
                outcome,
            });
        }
    }

    function request<T>(input: DecodedHttpRequest<T>): Promise<T>;
    // eslint-disable-next-line no-redeclare -- TypeScript overload signature.
    function request(input: HttpRequest): Promise<HttpResponse>;
    // eslint-disable-next-line no-redeclare -- Implementation of the overloads above.
    async function request<T>(
        input: HttpRequest | DecodedHttpRequest<T>
    ): Promise<HttpResponse | T> {
        assertLabel(input.operation);
        return observeHttpCall(options.name, input.operation, () => performRequest(input));
    }

    async function performRequest<T>(
        input: HttpRequest | DecodedHttpRequest<T>
    ): Promise<HttpResponse | T> {
        input = {
            ...input,
            singleflight: input.singleflight ? { ...input.singleflight } : input.singleflight,
        };
        const wire = prepare(input);
        const retry: RetryPolicy | false =
            input.retry === undefined
                ? defaultRetry
                : input.retry === false
                  ? false
                  : Object.freeze({ ...input.retry });
        validateRetryPolicy(retry);
        const request = { ...input, retry };
        if (
            input.singleflight &&
            (wire.body instanceof Stream ||
                !input.singleflight.key ||
                !input.singleflight.scope ||
                input.replay === 'never' ||
                (!['GET', 'HEAD'].includes(input.method) && input.replay !== 'safe'))
        )
            throw new TypeError(
                'Singleflight requires a safely replayable buffered request, key and credential scope'
            );
        const scope = createRequestScope(
            input.operation,
            [input.signal, lifetime.signal],
            input.timeoutMs ?? timeoutMs
        );
        let admitted = false;
        try {
            scope.signal.throwIfAborted();
            // Bound authentication/backoff waiters too, without occupying a socket slot.
            if (pending >= concurrency + maxQueue)
                throw new HttpError({ reason: 'queue-full', operation: input.operation });
            pending++;
            admitted = true;
            if (input.auth === 'required' && !gate)
                throw new HttpError({
                    reason: 'authentication-required',
                    operation: input.operation,
                });
            const lease =
                gate && input.auth !== 'none'
                    ? await observeHttpWait(options.name, input.operation, 'credential', () =>
                          gate.acquire(scope.signal, input.authWait)
                      )
                    : undefined;
            scope.link(lease?.signal);
            const send = async (signal: AbortSignal, budget = input.timeoutMs ?? timeoutMs) => {
                const sendScope = createRequestScope(
                    input.operation,
                    [signal, lease?.signal],
                    budget
                );
                try {
                    return await execute(request, wire, sendScope.signal, lease);
                } finally {
                    sendScope.dispose();
                }
            };
            let response: HttpResponse;
            if (input.singleflight) {
                // Include wire/auth and policy identity, so caller keys cannot merge different requests.
                const key = hashSHA256(
                    salt +
                        JSON.stringify([
                            input.singleflight.scope,
                            input.singleflight.key,
                            input.operation,
                            wire.method,
                            wire.url,
                            Object.entries({
                                ...wire.headers,
                                ...normalizeHeaders(lease?.headers ?? {}),
                            }).sort(),
                            Buffer.isBuffer(wire.body) ? wire.body.toString('base64') : wire.body,
                            wire.responseType,
                            input.replay,
                            input.authWait,
                            lease?.scope,
                            lease?.epoch,
                            lease?.revision,
                            retry === false
                                ? false
                                : [
                                      retry.maxAttempts,
                                      retry.baseDelayMs,
                                      retry.maxDelayMs,
                                      retry.backoff,
                                      identify(retry.shouldRetry),
                                  ],
                            identify(input.acceptStatus),
                        ])
                );
                try {
                    response = cloneResponse(
                        await flights.run(key, input.operation, scope.signal, () =>
                            send(lifetime.signal, timeoutMs)
                        )
                    );
                } catch (error) {
                    if (error instanceof HttpError)
                        throw new HttpError(
                            {
                                ...error.failure,
                                response: error.failure.response
                                    ? cloneResponse(error.failure.response)
                                    : undefined,
                            },
                            { cause: error }
                        );
                    throw error;
                }
            } else response = await send(scope.signal);
            scope.signal.throwIfAborted();
            if ((input.responseType ?? 'json') === 'json') {
                try {
                    response = {
                        ...response,
                        data:
                            input.method === 'HEAD' || [204, 205].includes(response.status)
                                ? undefined
                                : (JSON.parse(String(response.data)) as unknown),
                    };
                } catch (error) {
                    if (!(error instanceof SyntaxError)) throw error;
                    throw new HttpError(
                        {
                            reason: 'invalid-response',
                            operation: input.operation,
                            upstreamStatus: response.status,
                            response,
                        },
                        { cause: error }
                    );
                }
            }
            return 'decode' in input
                ? await waitFor(
                      Promise.resolve().then(() => {
                          scope.signal.throwIfAborted();
                          return input.decode(response);
                      }),
                      scope.signal
                  )
                : response;
        } finally {
            scope.dispose();
            if (admitted) pending--;
        }
    }

    return {
        request,
        dispose() {
            lifetime.abort();
            transport.dispose();
        },
    };
}

function assertLabel(value: string) {
    if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(value))
        throw new TypeError('Expected a bounded HTTP operation/upstream label');
}

function normalizeHeaders(headers: HttpHeaders): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (typeof value !== 'string') throw new TypeError('HTTP header values must be strings');
        if (['host', 'proxy-authorization'].includes(key.toLowerCase()))
            throw new TypeError('Routing headers are owned by the HTTP client');
        result[key.toLowerCase()] = value;
    }
    return result;
}

function cloneResponse(response: HttpResponse): HttpResponse {
    return {
        ...response,
        headers: Object.fromEntries(
            Object.entries(response.headers).map(([key, value]) => [
                key,
                typeof value === 'string' ? value : [...value],
            ])
        ),
        data: Buffer.isBuffer(response.data) ? Buffer.from(response.data) : response.data,
    };
}
