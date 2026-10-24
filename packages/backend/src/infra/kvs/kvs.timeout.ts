import type { KvsError } from './kvs.error.js';

export async function withKvsDeadline<T>(
    operation: () => Promise<T>,
    ms: number,
    error: KvsError,
    destroy: () => void
): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    let timeoutError: Error | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            timeoutError = error;
            try {
                destroy();
            } catch (cause) {
                timeoutError = new AggregateError([error, cause], 'KVS timeout cleanup failed');
            }
            reject(timeoutError);
        }, ms);
    });
    try {
        const result = await Promise.race([operation(), deadline]);
        // destroy() can synchronously settle close(); the expired deadline still wins.
        if (timeoutError) throw timeoutError;
        return result;
    } catch (cause) {
        throw timeoutError ?? cause;
    } finally {
        clearTimeout(timer);
    }
}
