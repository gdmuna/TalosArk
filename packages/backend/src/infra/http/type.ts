import type { CredentialGate, CredentialWait } from './credential-gate.js';
import type { HttpError } from './http.error.js';
import type { RetryPolicy } from './retry.js';
import type { Stream } from 'node:stream';

export type HttpMethod = 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type HttpHeaders = Readonly<Record<string, string>>;
export type HttpResponseHeaders = Readonly<Record<string, string | readonly string[]>>;
export type HttpBody =
    string | Buffer | URLSearchParams | Readonly<Record<string, unknown>> | Stream;

export interface HttpResponse<T = unknown> {
    status: number;
    statusText: string;
    headers: HttpResponseHeaders;
    data: T;
}

export interface HttpRequest {
    operation: string;
    method: HttpMethod;
    /** Owner-local path, relative to the configured API root. */
    path: string;
    headers?: HttpHeaders;
    params?: Readonly<
        Record<string, string | number | boolean | readonly (string | number)[] | undefined>
    >;
    body?: HttpBody;
    responseType?: 'json' | 'text' | 'binary';
    signal?: AbortSignal;
    /** Total budget, including queueing, authentication and backoff. */
    timeoutMs?: number;
    retry?: RetryPolicy | false;
    /** Explicitly attest safe replay of writes, or disable replay even for reads. */
    replay?: 'safe' | 'never';
    auth?: 'required' | 'none';
    authWait?: CredentialWait;
    acceptStatus?: (status: number) => boolean;
    /** Only equivalent buffered queries may opt in. Neither key nor scope may contain secrets. */
    singleflight?: { key: string; scope: string } | false;
}

export interface DecodedHttpRequest<T> extends HttpRequest {
    decode: (response: HttpResponse) => T | Promise<T>;
}

export interface HttpClient {
    request<T>(input: DecodedHttpRequest<T>): Promise<T>;
    request(input: HttpRequest): Promise<HttpResponse>;
    dispose(): void;
}

export interface HttpClientOptions {
    name: string;
    baseUrl: string;
    headers?: HttpHeaders;
    timeoutMs?: number;
    retry?: RetryPolicy | false;
    concurrency?: number;
    maxQueue?: number;
    maxRequestBytes?: number;
    maxResponseBytes?: number;
    /** Explicit proxy routing; ambient proxy environment variables are not used. */
    proxy?: { protocol: 'http' | 'https'; host: string; port: number } | false;
    credentialGate?: CredentialGate;
}

export interface HttpObservation {
    upstream: string;
    operation: string;
    attempts: number;
    durationMs: number;
    upstreamStatus?: number;
    outcome: 'success' | 'unexpected' | HttpError['failure']['reason'];
}
