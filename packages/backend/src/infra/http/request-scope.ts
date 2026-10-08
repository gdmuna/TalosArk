import { HttpError } from './http.error.js';

import { setTimeout as sleep } from 'node:timers/promises';

export function assertDuration(value: number, name: string) {
    if (!Number.isFinite(value) || value < 1 || value > 2 ** 31 - 1) {
        throw new RangeError(`${name} must be between 1 and ${2 ** 31 - 1} milliseconds`);
    }
}

export function createRequestScope(
    operation: string,
    signals: readonly (AbortSignal | undefined)[],
    timeoutMs: number
) {
    assertDuration(timeoutMs, 'timeoutMs');
    const controller = new AbortController();
    const listeners = new Map<AbortSignal, () => void>();
    function link(source: AbortSignal | undefined) {
        if (!source || listeners.has(source)) return;
        const abort = () =>
            controller.abort(
                source.reason instanceof HttpError
                    ? source.reason
                    : new HttpError({ reason: 'cancelled', operation }, { cause: source.reason })
            );
        listeners.set(source, abort);
        if (source.aborted) abort();
        else source.addEventListener('abort', abort, { once: true });
    }
    for (const source of signals) link(source);
    const timer = setTimeout(
        () => controller.abort(new HttpError({ reason: 'timeout', operation })),
        timeoutMs
    );
    return {
        signal: controller.signal,
        link,
        dispose() {
            clearTimeout(timer);
            for (const [source, abort] of listeners) source.removeEventListener('abort', abort);
        },
    };
}

export function waitFor<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const abort = () => {
            signal.removeEventListener('abort', abort);
            reject(signal.reason);
        };
        // Always observe the producer, including after a waiter cancels.
        Promise.resolve(promise).then(
            (value) => {
                signal.removeEventListener('abort', abort);
                resolve(value);
            },
            (error) => {
                signal.removeEventListener('abort', abort);
                reject(error);
            }
        );
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
    });
}

export async function delay(ms: number, signal: AbortSignal) {
    signal.throwIfAborted();
    try {
        await sleep(ms, undefined, { signal });
    } catch (error) {
        if (signal.aborted) throw signal.reason;
        throw error;
    }
}
