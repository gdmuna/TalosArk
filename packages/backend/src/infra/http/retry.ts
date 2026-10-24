import type { HttpError } from './http.error.js';
import { assertDuration } from './request-scope.js';

export interface RetryPolicy {
    /** Includes the initial transient-failure attempt; authentication allows one additional send. */
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    backoff?: 'linear' | 'exponential';
    shouldRetry?: (error: HttpError, failedAttempt: number) => boolean;
}

export function validateRetryPolicy(policy: RetryPolicy | false) {
    if (policy === false) return;
    if (!Number.isSafeInteger(policy.maxAttempts ?? 3) || (policy.maxAttempts ?? 3) < 1) {
        throw new RangeError('maxAttempts must be a positive safe integer');
    }
    assertDuration(policy.baseDelayMs ?? 300, 'baseDelayMs');
    assertDuration(policy.maxDelayMs ?? 10_000, 'maxDelayMs');
    if (policy.backoff !== undefined && !['linear', 'exponential'].includes(policy.backoff)) {
        throw new TypeError('backoff must be linear or exponential');
    }
}

export function retryDelay(error: HttpError, attempt: number, policy: RetryPolicy | false) {
    if (policy === false || attempt >= (policy.maxAttempts ?? 3)) return null;
    const { reason, upstreamStatus: status, retryAfterMs } = error.failure;
    if (!['network', 'timeout', 'http-status'].includes(reason) || status === 401 || status === 403)
        return null;
    const eligible =
        policy.shouldRetry?.(error, attempt) ??
        (reason === 'network' ||
            reason === 'timeout' ||
            (status !== undefined && [408, 429, 502, 503, 504].includes(status)));
    if (!eligible) return null;
    const cap = policy.maxDelayMs ?? 10_000;
    if (retryAfterMs !== undefined && retryAfterMs > cap) return null;
    const multiplier = policy.backoff === 'linear' ? attempt : 2 ** (attempt - 1);
    const backoff = Math.min(cap, (policy.baseDelayMs ?? 300) * multiplier);
    return Math.max(retryAfterMs ?? 0, backoff * (0.5 + Math.random() * 0.5));
}

export function parseRetryAfter(value: string | undefined): number | undefined {
    if (!value) return undefined;
    if (/^\d+$/.test(value)) return Number(value) * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed - Date.now()) : undefined;
}
