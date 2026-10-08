import { HttpError } from './http.error.js';

export class RequestQueue {
    private active = 0;
    private readonly waiting: Array<{ grant: () => void }> = [];

    constructor(
        private readonly concurrency: number,
        private readonly maxQueue: number
    ) {
        if (
            !Number.isSafeInteger(concurrency) ||
            concurrency < 1 ||
            !Number.isSafeInteger(maxQueue) ||
            maxQueue < 0
        ) {
            throw new RangeError('Invalid HTTP concurrency or queue limit');
        }
    }

    async acquire(operation: string, signal: AbortSignal): Promise<() => void> {
        signal.throwIfAborted();
        if (this.active < this.concurrency) {
            this.active++;
            return this.releaseOnce();
        }
        if (this.waiting.length >= this.maxQueue)
            throw new HttpError({ reason: 'queue-full', operation });
        return new Promise((resolve, reject) => {
            const entry = {
                grant: () => {
                    signal.removeEventListener('abort', abort);
                    resolve(this.releaseOnce());
                },
            };
            const abort = () => {
                const index = this.waiting.indexOf(entry);
                if (index >= 0) this.waiting.splice(index, 1);
                signal.removeEventListener('abort', abort);
                reject(signal.reason);
            };
            this.waiting.push(entry);
            signal.addEventListener('abort', abort, { once: true });
        });
    }

    private releaseOnce() {
        let released = false;
        return () => {
            if (released) return;
            released = true;
            // Transfer the occupied slot before waking the next waiter; new requests cannot steal it.
            const next = this.waiting.shift();
            if (next) next.grant();
            else this.active--;
        };
    }
}
