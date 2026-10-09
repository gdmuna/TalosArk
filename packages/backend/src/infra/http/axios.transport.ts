import { HttpError } from './http.error.js';
import type {
    HttpBody,
    HttpClient,
    HttpClientOptions,
    HttpHeaders,
    HttpMethod,
    HttpResponse,
} from './type.js';

import axios, {
    AxiosError,
    AxiosHeaders,
    CanceledError,
    type AxiosAdapter,
    type AxiosResponse,
} from 'axios';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';

export interface WireRequest {
    operation: string;
    method: HttpMethod;
    url: string;
    headers: HttpHeaders;
    body?: HttpBody;
    responseType: 'text' | 'binary';
}

export function createAxiosTransport(options: HttpClientOptions, concurrency: number) {
    const httpAgent = new HttpAgent({
        keepAlive: true,
        maxSockets: concurrency,
        maxFreeSockets: Math.min(concurrency, 4),
    });
    const httpsAgent = new HttpsAgent({
        keepAlive: true,
        maxSockets: concurrency,
        maxFreeSockets: Math.min(concurrency, 4),
    });
    const transport = axios.create({
        adapter: 'http',
        httpAgent,
        httpsAgent,
        proxy: options.proxy ?? false,
        maxRedirects: 0,
        maxBodyLength: options.maxRequestBytes ?? 10 * 1024 * 1024,
        maxContentLength: options.maxResponseBytes ?? 10 * 1024 * 1024,
        timeout: 0,
        validateStatus: () => true,
        transformRequest: [(data) => data],
        transformResponse: [(data) => data],
    });
    return {
        async send(input: WireRequest, signal: AbortSignal): Promise<HttpResponse> {
            try {
                const response = await transport.request<unknown>({
                    method: input.method,
                    url: input.url,
                    headers: { ...input.headers },
                    data: input.body,
                    responseType: input.responseType === 'binary' ? 'arraybuffer' : 'text',
                    signal,
                });
                const headers: Record<string, string | string[]> = {};
                for (const [key, value] of Object.entries(response.headers)) {
                    if (value !== undefined && value !== null)
                        headers[key.toLowerCase()] = Array.isArray(value)
                            ? value.map(String)
                            : String(value);
                }
                return {
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                    data: response.data,
                };
            } catch (error) {
                if (signal.aborted) throw signal.reason;
                if (!axios.isAxiosError(error)) throw error;
                const code = error.code ?? '';
                const reason = ['ETIMEDOUT', 'ECONNABORTED'].includes(code)
                    ? 'timeout'
                    : [
                            'ERR_NETWORK',
                            'ECONNREFUSED',
                            'ECONNRESET',
                            'EPIPE',
                            'ENOTFOUND',
                            'EAI_AGAIN',
                        ].includes(code)
                      ? 'network'
                      : code === 'ERR_BAD_RESPONSE'
                        ? 'invalid-response'
                        : undefined;
                if (!reason) throw error;
                throw new HttpError({ reason, operation: input.operation }, { cause: error });
            }
        },
        dispose() {
            httpAgent.destroy();
            httpsAgent.destroy();
        },
    };
}

/** SDKs already perform their Axios transforms outside this adapter. Pass raw bytes/text through once. */
export function createSdkAxiosAdapter(client: HttpClient, baseUrl: string): AxiosAdapter {
    const root = new URL(baseUrl.replace(/\/+$/, '') + '/');
    return async (config) => {
        if (config.responseType && !['json', 'text', 'arraybuffer'].includes(config.responseType)) {
            throw new TypeError('The outbound SDK bridge supports buffered responses only');
        }
        if (config.cancelToken)
            throw new TypeError('Use AbortSignal instead of legacy CancelToken');
        if (config.signal && !(config.signal instanceof AbortSignal))
            throw new TypeError('A native AbortSignal is required');
        const target = new URL(axios.getUri(config), root);
        if (
            target.origin !== root.origin ||
            !target.pathname.startsWith(root.pathname) ||
            target.username ||
            target.password ||
            target.hash
        ) {
            throw new TypeError('SDK request escaped its configured API root');
        }
        const response = (value: HttpResponse): AxiosResponse => ({
            ...value,
            headers: AxiosHeaders.from(
                Object.fromEntries(
                    Object.entries(value.headers).map(([key, header]) => [
                        key,
                        typeof header === 'string' ? header : [...header],
                    ])
                )
            ),
            config,
        });
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(config.headers.toJSON())) {
            if (value !== undefined && value !== null) headers[key] = String(value);
        }
        if (config.auth)
            headers.authorization = `Basic ${Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64')}`;
        try {
            return response(
                await client.request({
                    operation: 'sdk.request',
                    method: (config.method ?? 'GET').toUpperCase() as HttpMethod,
                    path: '/' + target.pathname.slice(root.pathname.length) + target.search,
                    headers,
                    body: config.data,
                    responseType: config.responseType === 'arraybuffer' ? 'binary' : 'text',
                    auth: 'none',
                    signal: config.signal,
                    timeoutMs: config.timeout || undefined,
                    retry: false,
                    singleflight: false,
                    acceptStatus: config.validateStatus ?? (() => true),
                })
            );
        } catch (error) {
            if (!(error instanceof HttpError)) throw error;
            const code =
                error.failure.reason === 'timeout'
                    ? AxiosError.ECONNABORTED
                    : error.failure.reason === 'cancelled'
                      ? AxiosError.ERR_CANCELED
                      : error.failure.reason === 'network'
                        ? AxiosError.ERR_NETWORK
                        : (error.failure.response?.status ?? 0) >= 500
                          ? AxiosError.ERR_BAD_RESPONSE
                          : AxiosError.ERR_BAD_REQUEST;
            const wrapped =
                code === AxiosError.ERR_CANCELED
                    ? new CanceledError('Outbound SDK request cancelled', config)
                    : new AxiosError(
                          'Outbound SDK request failed',
                          code,
                          config,
                          undefined,
                          error.failure.response ? response(error.failure.response) : undefined
                      );
            wrapped.cause = error;
            throw wrapped;
        }
    };
}
