const MAX_DELAY = 2 ** 31 - 1;

export function assertDuration(value: number, name: string) {
    if (!Number.isFinite(value) || value < 0 || value > MAX_DELAY) {
        throw new RangeError(`${name} must be between 0 and ${MAX_DELAY} milliseconds`);
    }
}

export function createTaskScope(signals: readonly (AbortSignal | undefined)[], timeoutMs?: number) {
    if (timeoutMs !== undefined) assertDuration(timeoutMs, 'timeoutMs');
    const controller = new AbortController();
    const sources = signals.filter((signal): signal is AbortSignal => !!signal);
    const abort = (event: Event) => controller.abort((event.target as AbortSignal).reason);
    for (const signal of sources) {
        if (signal.aborted) controller.abort(signal.reason);
        else signal.addEventListener('abort', abort, { once: true });
    }
    const timer =
        timeoutMs === undefined
            ? undefined
            : setTimeout(() => {
                  controller.abort(new DOMException('Task timed out', 'TimeoutError'));
              }, timeoutMs);
    return {
        signal: controller.signal,
        dispose() {
            controller.abort(new DOMException('Task scope disposed', 'AbortError'));
            clearTimeout(timer);
            for (const signal of sources) signal.removeEventListener('abort', abort);
        },
    };
}

export function waitFor<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const abort = () => {
            signal.removeEventListener('abort', abort);
            reject(signal.reason);
        };
        // Observe the promise even if already aborted, so a late rejection is still handled.
        promise.then(
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

export function delay(ms: number, signal: AbortSignal): Promise<void> {
    assertDuration(ms, 'delay');
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve();
        }, ms);
        signal.addEventListener('abort', abort, { once: true });
    });
}
