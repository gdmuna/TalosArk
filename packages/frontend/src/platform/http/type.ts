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

export interface HttpRequest<T> extends RequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    schema: z.ZodType<T>;
    auth?: 'required' | 'none';
    body?: unknown;
    params?: Readonly<
        Record<string, string | number | boolean | readonly (string | number)[] | undefined>
    >;
    headers?: Readonly<Record<string, string>>;
}

export interface HttpClientOptions {
    /** Full API root, including the version prefix. */
    baseUrl: string;
    auth?: AuthGate;
    timeoutMs?: number;
    retry?: RetryPolicy | false;
}

export interface HttpClient {
    request<T>(request: HttpRequest<T>): Promise<T>;
    dispose(): void;
}
