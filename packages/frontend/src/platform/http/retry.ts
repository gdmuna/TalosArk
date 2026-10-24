import type { HttpError } from './error';
import { assertDuration } from '../task';

export interface RetryPolicy {
    /** Transient-failure attempt budget, excluding the single authentication replay. */
    maxAttempts?: number;
    /** Defaults to exponential; both strategies retain jitter and the delay cap. */
    backoff?: 'linear' | 'exponential';
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: HttpError, failedAttempt: number) => boolean;
}

export function validateRetryPolicy(policy: RetryPolicy | false) {
    if (policy === false) return;
    const attempts = policy.maxAttempts ?? 3;
    if (!Number.isSafeInteger(attempts) || attempts < 1)
        throw new RangeError('maxAttempts must be a positive integer');
    if (policy.backoff !== undefined && !['linear', 'exponential'].includes(policy.backoff))
        throw new TypeError('backoff must be linear or exponential');
    assertDuration(policy.baseDelayMs ?? 300, 'baseDelayMs');
    assertDuration(policy.maxDelayMs ?? 10_000, 'maxDelayMs');
}

export function retryDelay(
    error: HttpError,
    failedAttempt: number,
    policy: RetryPolicy | false
): number | null {
    if (policy === false || failedAttempt >= (policy.maxAttempts ?? 3)) return null;
    if (error.kind === 'protocol' || error.status === 401 || error.status === 403) return null;
    const retryable =
        policy.shouldRetry?.(error, failedAttempt) ??
        (error.kind === 'network' ||
            error.kind === 'timeout' ||
            (error.status !== undefined && [408, 429, 502, 503, 504].includes(error.status)));
    if (!retryable) return null;
    const cap = policy.maxDelayMs ?? 10_000;
    // Retry-After is a lower bound; do not retry early if the server asks for longer than the cap.
    if (error.retryAfterMs !== undefined && error.retryAfterMs > cap) return null;
    const multiplier = policy.backoff === 'linear' ? failedAttempt : 2 ** (failedAttempt - 1);
    const backoff = Math.min(cap, (policy.baseDelayMs ?? 300) * multiplier);
    return Math.max(error.retryAfterMs ?? 0, backoff * (0.5 + Math.random() * 0.5));
}

export function parseRetryAfter(value: unknown): number | undefined {
    if (typeof value !== 'string') return undefined;
    if (/^\d+$/.test(value)) return Number(value) * 1000;
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}
