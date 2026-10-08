import { HttpError } from './http.error.js';
import { waitFor } from './request-scope.js';

export class Singleflight<T> {
    private readonly flight = new Map<string, Promise<T>>();

    constructor(private readonly maxFlight: number) {}

    run(key: string, operation: string, signal: AbortSignal, task: () => Promise<T>): Promise<T> {
        signal.throwIfAborted();
        let promise = this.flight.get(key);
        if (!promise) {
            if (this.flight.size >= this.maxFlight)
                throw new HttpError({ reason: 'queue-full', operation });
            promise = Promise.resolve()
                .then(task)
                .finally(() => this.flight.delete(key));
            this.flight.set(key, promise);
        }
        return waitFor(promise, signal);
    }
}
