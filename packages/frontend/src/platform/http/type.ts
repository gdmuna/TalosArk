import type { z } from 'zod';
import type { AuthGate, AuthWait } from './auth-gate';
import type { RetryPolicy } from './retry';

export interface RequestOptions {
    signal?: AbortSignal;
    /** Total deadline, including authentication waiting and retry backoff. */
    timeoutMs?: number;
    retry?: RetryPolicy | false;
    authWait?: AuthWait;
}

interface HttpRequestBase extends RequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    auth?: 'required' | 'none';
    body?: unknown;
    params?: Readonly<
        Record<string, string | number | boolean | readonly (string | number)[] | undefined>
    >;
    headers?: Readonly<Record<string, string>>;
}

export interface JsonHttpRequest<T> extends HttpRequestBase {
    schema: z.ZodType<T>;
    response?: 'json';
}

export interface EmptyHttpRequest extends HttpRequestBase {
    response: 'empty';
    schema?: never;
}

export type HttpRequest<T> = JsonHttpRequest<T> | EmptyHttpRequest;

export interface HttpClientOptions {
    /** Full API root, including the version prefix. */
    baseUrl: string;
    auth?: AuthGate;
    timeoutMs?: number;
    retry?: RetryPolicy | false;
}

export interface HttpClient {
    request(request: EmptyHttpRequest): Promise<void>;
    request<T>(request: JsonHttpRequest<T>): Promise<T>;
    dispose(): void;
}
